from kokoro import KPipeline
import soundfile as sf

pipeline = KPipeline(lang_code='a')
text = "Hello, I'm Alice, your personal hotel concierge. I'm here to help you find the room you'll love."

generator = pipeline(text, voice='af_heart')
for i, (gs, ps, audio) in enumerate(generator):
    sf.write(f'kokoro_heart_{i}.wav', audio, 24000)
    print(f"Saved kokoro_heart_{i}.wav")
