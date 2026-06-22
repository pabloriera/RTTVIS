docker run --rm -it \
  --name libretranslate-es-en-cpu \
  -p 5000:5000 \
  -e LT_LOAD_ONLY=es,en \
  -e LT_UPDATE_MODELS=true \
  -e LT_DISABLE_WEB_UI=true \
  -e LT_HOST=0.0.0.0 \
  -v libretranslate-db:/app/db \
  -v libretranslate-data:/root/.local \
  libretranslate/libretranslate:latest

  docker run --rm -it \
  --name libretranslate-es-en-gpu \
  --gpus all \
  -p 5000:5000 \
  -e ARGOS_DEVICE_TYPE=cuda \
  -e LT_LOAD_ONLY=es,en \
  -e LT_UPDATE_MODELS=true \
  -e LT_DISABLE_WEB_UI=true \
  -e LT_HOST=0.0.0.0 \
  -v libretranslate-db:/app/db \
  -v libretranslate-data:/root/.local \
  libretranslate/libretranslate:latest-cuda