import os
import requests
from pathlib import Path

# Create directories if they don't exist
fonts_dir = Path("assets/fonts")
fonts_dir.mkdir(parents=True, exist_ok=True)

# List of free fonts with direct download links
fonts_to_download = [
    {
        "name": "Impact",
        "url": "https://freefontsdownload.net/download/74559/impact.ttf",
        "filename": "Impact.ttf"
    },
    {
        "name": "Bebas Neue",
        "url": "https://github.com/dharmatype/Bebas-Neue/raw/master/fonts/otf/BebasNeue-Regular.otf",
        "filename": "BebasNeue-Regular.otf"
    },
    {
        "name": "Anton",
        "url": "https://github.com/google/fonts/raw/main/ofl/anton/Anton-Regular.ttf",
        "filename": "Anton-Regular.ttf"
    },
    {
        "name": "Six Caps",
        "url": "https://github.com/google/fonts/raw/main/ofl/sixcaps/SixCaps.ttf",
        "filename": "SixCaps.ttf"
    }
]

def download_font(font_info):
    """Download font file from direct URL"""
    font_name = font_info["name"]
    font_filename = font_info["filename"]
    font_url = font_info["url"]
    font_path = fonts_dir / font_filename
    
    print(f"Downloading {font_name}...")
    
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
        }
        response = requests.get(font_url, headers=headers, stream=True)
        
        if response.status_code == 200:
            with open(font_path, 'wb') as f:
                f.write(response.content)
            print(f"✓ Successfully downloaded {font_name} to {font_path}")
            return True
        else:
            print(f"✗ Failed to download {font_name}. Status code: {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ Error downloading {font_name}: {str(e)}")
        return False

def main():
    """Download and install all required fonts"""
    print("Starting font installation for ProCaptions...")
    
    success_count = 0
    for font_info in fonts_to_download:
        if download_font(font_info):
            success_count += 1
    
    print(f"Font installation complete! Successfully installed {success_count}/{len(fonts_to_download)} fonts.")
    print("Available fonts:")
    for font_file in os.listdir(fonts_dir):
        print(f" - {font_file}")

if __name__ == "__main__":
    main() 