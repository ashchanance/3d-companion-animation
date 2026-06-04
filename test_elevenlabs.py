import os
from elevenlabs.client import ElevenLabs

# API Key provided by user
API_KEY = "sk_432014ebd2bc17401c49d9ae5ae8b6ffd39c7356b4b98734"

def test_elevenlabs():
    print("=== ElevenLabs API Test ===")
    
    try:
        # Initialize client
        client = ElevenLabs(api_key=API_KEY)
        
        # 1. Verify Authentication by fetching user info or voices
        print("\n[1/3] Verifying Authentication...")
        # Fetching voices is a good way to test the key
        response = client.voices.get_all()
        voices = response.voices
        print(f"✅ Connection Successful!")
        print(f"✅ Found {len(voices)} available voices.")
        
        # List a few voices for reference
        print("\n[2/3] Sample Voices:")
        for voice in voices[:3]:
            print(f" - {voice.name}: {voice.voice_id}")
            
        # 2. Test Text-to-Speech generation
        print("\n[3/3] Generating Test Audio...")
        test_text = "Halo! Ini adalah tes dari Eleven Labs abduls speed shop. Jika Anda mendengar suara ini, berarti API Key Anda sudah aktif dan berfungsi dengan baik."
        
        # Use simple voice (usually the first one is 'Rachel' or 'Ariana')
        # We can also use a specific voice ID if we want, but using the first one is safer for a test.
        selected_voice = voices[0]
        print(f"Using voice: {selected_voice.name}")
        
        audio_generator = client.text_to_speech.convert(
            text=test_text,
            voice_id=selected_voice.voice_id,
            model_id="eleven_multilingual_v2",
            output_format="mp3_44100_128"
        )
        
        # The generator yields chunks of bytes
        audio_data = b""
        for chunk in audio_generator:
            audio_data += chunk
            
        # Save to file
        output_filename = "test_elevenlabs_output.mp3"
        with open(output_filename, "wb") as f:
            f.write(audio_data)
            
        full_path = os.path.abspath(output_filename)
        print(f"✅ Audio successfully generated and saved to:")
        print(f"   {full_path}")
        
        print("\n=== TEST RESULT: PASSED ===")

    except Exception as e:
        print(f"\n❌ FAILED: An error occurred.")
        print(f"Error details: {str(e)}")
        print("\n=== TEST RESULT: FAILED ===")

if __name__ == "__main__":
    test_elevenlabs()
