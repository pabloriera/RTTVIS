#!/usr/bin/env python3
import argparse
import io
import os
import sys

try:
    import httpx
    import numpy as np
    from PIL import Image
except ImportError as e:
    print(f"Error: Missing required library. {e}")
    print("Please install them using: pip install httpx numpy Pillow")
    sys.exit(1)

def get_sam3_mask(image_path: str, server_ip: str, port: int = 9000, prompt: str = "person"):
    """
    Sends an image to the SAM 3 service and returns a NumPy array 
    where each pixel value represents an instance ID.
    """
    url = f"http://{server_ip}:{port}/v1/segment"
    
    print(f"Connecting to service at: {url}...")
    print(f"Using image: '{image_path}' and prompt: '{prompt}'")
    
    if not os.path.exists(image_path):
        print(f"Error: Local image file '{image_path}' does not exist.")
        sys.exit(1)
        
    with open(image_path, "rb") as f:
        files = {"image": (image_path, f, "image/jpeg")}
        # request string matches the API schema in app/schemas.py
        data = {"request": f'{{"prompt": {{"type": "text", "text": "{prompt}"}}}}'}
        
        try:
            response = httpx.post(url, files=files, data=data, timeout=30.0)
            response.raise_for_status()
        except httpx.ConnectError as e:
            print(f"\nConnection Error: Could not connect to {server_ip} on port {port}.")
            print("Please check if the server is running and accessible over the network.")
            print(f"Details: {e}")
            sys.exit(1)
        except httpx.HTTPStatusError as e:
            print(f"\nHTTP Error: Received status code {response.status_code}")
            print(f"Response content: {response.text}")
            sys.exit(1)
        except Exception as e:
            print(f"\nUnexpected error during request: {e}")
            sys.exit(1)

    # The service returns a 16-bit PNG
    try:
        mask_img = Image.open(io.BytesIO(response.content))
        mask_array = np.array(mask_img)
        return mask_array
    except Exception as e:
        print(f"\nError: Failed to parse response as image. {e}")
        print(f"Response content prefix: {response.content[:200]}")
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Test SAM 3 service accessibility on machine 10.1.100.79")
    parser.add_argument(
        "--server", 
        default="10.1.100.79", 
        help="IP address of the SAM 3 server (default: 10.1.100.79)"
    )
    parser.add_argument(
        "--port", 
        type=int,
        default=9000, 
        help="Port of the SAM 3 server (default: 9000)"
    )
    parser.add_argument(
        "--image", 
        default="media/3187.jpg", 
        help="Path to the image to segment (default: media/3187.jpg)"
    )
    parser.add_argument(
        "--prompt", 
        default="person", 
        help="Text prompt for segmentation (default: person)"
    )
    parser.add_argument(
        "--output", 
        default="mask_output.png", 
        help="Path to save the resulting mask (default: mask_output.png)"
    )
    
    args = parser.parse_args()
    
    # Run the segmenter
    mask = get_sam3_mask(args.image, args.server, args.port, args.prompt)
    
    # Success details
    print("\nSuccess! The SAM 3 service is reachable and functional.")
    print(f"Returned mask shape: {mask.shape}")
    print(f"Returned mask data type: {mask.dtype}")
    print(f"Maximum object instance ID found: {mask.max()}")
    
    unique_vals = np.unique(mask)
    print(f"Unique pixel values in mask (instance IDs): {list(unique_vals)}")
    
    # Save mask visualization or output
    try:
        # Save the original 16-bit PNG format or a normalized 8-bit visual representation
        # Saving directly as returned
        out_img = Image.fromarray(mask)
        out_img.save(args.output)
        print(f"Saved returned mask to: {args.output}")
        
        # Save a normalized visual mask for easy viewing
        if mask.max() > 0:
            visual_mask = (mask * (255 // mask.max())).astype(np.uint8)
            visual_img = Image.fromarray(visual_mask)
            visual_path = "mask_visualization.png"
            visual_img.save(visual_path)
            print(f"Saved visual-friendly mask to: {visual_path}")
            
    except Exception as e:
        print(f"Could not save mask to disk: {e}")

if __name__ == "__main__":
    main()
