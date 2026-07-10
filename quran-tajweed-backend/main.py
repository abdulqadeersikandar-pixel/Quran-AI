from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from groq import Groq
import os
import shutil
import json
import re
import difflib

# .env file se API key load karna
load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Groq Client setup
client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

# Text model for tajweed feedback (llama-3.3 is being retired by Groq, so we use
# a current production model here)
FEEDBACK_MODEL = "openai/gpt-oss-120b"

TASHKEEL_PATTERN = re.compile(
    r'[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]'
)

# Ek lafz ko "sahi" maanne ke liye kam se kam kitni similarity chahiye (0-1 ke darmiyan)
WORD_SIMILARITY_THRESHOLD = 0.72


def normalize_arabic(text: str) -> str:
    """Tashkeel hata kar aur letters ko normalize kar ke loose comparison ke liye tayyar karta hai."""
    if not text:
        return ""
    text = TASHKEEL_PATTERN.sub('', text)
    text = text.replace('\u0640', '')  # tatweel (ـ) hata dena
    text = (
        text.replace('ٱ', 'ا')
        .replace('أ', 'ا')
        .replace('إ', 'ا')
        .replace('آ', 'ا')
        .replace('ى', 'ي')
        .replace('ة', 'ه')
        .replace('ؤ', 'و')
        .replace('ئ', 'ي')
    )
    return text.strip()


def word_similarity(word_a, word_b):
    """Do alfaaz kitne milte julte hain (0 = bilkul mukhtalif, 1 = bilkul same)."""
    if not word_a or not word_b:
        return 0.0
    return difflib.SequenceMatcher(None, word_a, word_b).ratio()


def align_words(expected_words_raw, spoken_text):
    """
    Expected (Quranic) alfaaz aur student ke bole hue alfaaz ko align karta hai
    taake pata chale kaunsa lafz sahi bola, kaunsa ghalat, aur kaunsa chhoot gaya.

    Whisper transcription kabhi kabhi ek aadhi harkat ya letter thoda farq se
    likhta hai (hamza, alif waghera) — is liye sirf 100% exact match par bharosa
    karne ki bajaye, milti julti (fuzzy) similarity bhi check karte hain taake
    sahi bola gaya lafz ghalti se "incorrect" na ban jaye.
    """
    expected_norm = [normalize_arabic(w) for w in expected_words_raw]
    spoken_norm_all = normalize_arabic(spoken_text).split()

    print("🔎 Expected (normalized):", expected_norm)
    print("🔎 Spoken (normalized):", spoken_norm_all)

    matcher = difflib.SequenceMatcher(None, expected_norm, spoken_norm_all, autojunk=False)

    word_results = []
    mistakes = []
    matched_count = 0

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == 'equal':
            for offset in range(i2 - i1):
                k = i1 + offset
                word_results.append({
                    "expected": expected_words_raw[k],
                    "spoken": spoken_norm_all[j1 + offset],
                    "status": "correct",
                })
                matched_count += 1
        elif tag == 'replace':
            exp_slice = expected_words_raw[i1:i2]
            exp_norm_slice = expected_norm[i1:i2]
            spo_slice = spoken_norm_all[j1:j2]
            for idx, exp_w in enumerate(exp_slice):
                spo_w = spo_slice[idx] if idx < len(spo_slice) else None
                # Exact match na ho tab bhi, agar lafz kaafi milta julta hai (fuzzy) toh sahi maan lete hain
                if spo_w and word_similarity(exp_norm_slice[idx], spo_w) >= WORD_SIMILARITY_THRESHOLD:
                    word_results.append({"expected": exp_w, "spoken": spo_w, "status": "correct"})
                    matched_count += 1
                else:
                    word_results.append({"expected": exp_w, "spoken": spo_w, "status": "incorrect"})
                    mistakes.append({"expected": exp_w, "spoken": spo_w})
        elif tag == 'delete':
            for k in range(i1, i2):
                word_results.append({"expected": expected_words_raw[k], "spoken": None, "status": "missing"})
                mistakes.append({"expected": expected_words_raw[k], "spoken": None})
        # tag == 'insert' -> student ne extra alfaaz bole jo expected mein nahi the, ignore karte hain

    total = len(expected_words_raw) if expected_words_raw else 0
    score = round((matched_count / total) * 100) if total else 0

    return word_results, mistakes, score


def generate_tajweed_feedback(mistakes):
    """Groq ke text model se har ghalat lafz ke liye tajweed correction generate karwata hai."""
    if not mistakes:
        return []

    mistakes = mistakes[:6]  # cost aur clutter control ke liye sirf top 6 galtiyan
    mistakes_desc = "\n".join(
        f"{i + 1}. Sahi lafz: {m['expected']} | Student ne kaha: {m['spoken'] or '(kuch mafhoom nahi hua)'}"
        for i, m in enumerate(mistakes)
    )

    prompt = f"""Tum aik tajweed ustaad ho jo Quran ki qir'at sikhatay ho. Neeche diye gaye Quranic alfaaz mein
student ne tilawat karte waqt ghalati ki hai (naa-sahi makhraj ya tajweed ka masla).

Har lafz ke liye Roman Urdu mein bataao:
1. "issue": mukhtasar batao kya ghalati hui (makhraj, madd, ghunnah, qalqalah, idgham, ikhfa, tafkhim/tarqeeq mein se jo bhi is lafz par relevant ho)
2. "correction": sahi tareeqa kaise ada karein, aik chota practical tip

Alfaaz:
{mistakes_desc}

Sirf ek JSON array return karo, koi aur text, preamble ya markdown nahi. Format bilkul yeh ho:
[{{"word": "lafz", "issue": "chota sa masla", "correction": "sahi tareeqa"}}]"""

    try:
        completion = client.chat.completions.create(
            model=FEEDBACK_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_completion_tokens=800,
        )
        raw = completion.choices[0].message.content.strip()
        raw = raw.replace("```json", "").replace("```", "").strip()

        # Agar model ne JSON ke aage peeche kuch text likh diya ho, toh sirf array nikal lo
        match = re.search(r'\[.*\]', raw, re.DOTALL)
        if match:
            raw = match.group(0)

        feedback = json.loads(raw)
        if isinstance(feedback, list):
            return feedback
        return []
    except Exception as e:
        print("Tajweed feedback generate karne mein error:", e)
        # Fallback: generic guidance taake user khali haath na jaye
        return [
            {
                "word": m['expected'],
                "issue": "Pronunciation mein farq mehsoos hua",
                "correction": "Lafz ko aahista, harf ba harf, sahi makhraj se dobara ada karein",
            }
            for m in mistakes
        ]


@app.get("/")
def read_root():
    return {"message": "Bismillah! FastAPI Server is running."}


@app.post("/api/analyze-audio")
async def analyze_audio(
    audio: UploadFile = File(...),
    expected_text: str = Form(""),
):
    temp_file_path = f"temp_{audio.filename}"
    try:
        # 1. Audio file ko temporarily server par save karna
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(audio.file, buffer)

        # 2. Asli AI (Groq Whisper) ko audio bhej kar text mangwana
        with open(temp_file_path, "rb") as file:
            transcription = client.audio.transcriptions.create(
                file=(temp_file_path, file.read()),
                model="whisper-large-v3",  # Yeh stable audio model hai
                language="ar",  # AI ko batana ke language Arabic hai
                response_format="json",
            )

        # 3. AI ne jo text pehchana woh extract karna
        recognized_text = transcription.text
        print("🤖 AI Ne Yeh Suna:", recognized_text)

        # 4. File ka kaam khatam, usay delete kar do
        os.remove(temp_file_path)

        # 5. Expected (asal Quranic) alfaaz ke sath word-by-word alignment
        expected_words_raw = expected_text.split() if expected_text else []
        print("📩 Expected text received:", expected_text)
        word_results, mistakes, score = align_words(expected_words_raw, recognized_text)

        # 6. Ghalat alfaaz ke liye AI se tajweed correction feedback banwana
        tajweed_feedback = generate_tajweed_feedback(mistakes)

        return {
            "status": "success",
            "recognized_text": recognized_text,
            "score": score,
            "word_results": word_results,
            "tajweed_feedback": tajweed_feedback,
        }

    except Exception as e:
        print("Error aagaya:", e)
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        return {"status": "error", "message": str(e)}
