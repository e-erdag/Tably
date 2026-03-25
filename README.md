# tably

## run the app

install the backend dependencies once:

```bash
cd homr-service/homr
poetry install --only main
cd ../..
```

from the project root, start the backend and frontend together with:

```bash
./run_dev.sh
```

this starts:

- the backend api at `http://localhost:8000`
- the frontend dev server at `http://localhost:5173`

if the script is not executable yet, run:

```bash
chmod +x ./run_dev.sh
```

## test in the browser

1. run `./run_dev.sh`
2. open `http://localhost:5173`
3. upload one of these file types:
   `.mscz`, `.musicxml`, `.xml`, `.png`, `.jpg`, `.jpeg`
4. the app should download a `.musicxml` file after conversion

## test the backend directly

check that the api is alive:

```bash
curl http://localhost:8000/health
```

convert an image:

```bash
curl -X POST -F "file=@/full/path/to/score.png" http://localhost:8000/convert --output score.musicxml
```

convert an mscz file:

```bash
curl -X POST -F "file=@/full/path/to/score.mscz" http://localhost:8000/convert --output score.musicxml
```

pass through an existing musicxml file:

```bash
curl -X POST -F "file=@/full/path/to/score.musicxml" http://localhost:8000/convert --output score.musicxml
```

## run only the backend

if you only want the api without the frontend:

```bash
cd homr-service/homr
poetry run uvicorn unified_api:app --app-dir ../../Back-End --host 0.0.0.0 --port 8000
```

## notes

- image uploads use `homr`, so the first image request may take longer while models initialize
- `.mscz` conversion depends on museScore being installed at `/Applications/MuseScore 4.app/Contents/MacOS/mscore`
- supported upload types are `.mscz`, `.musicxml`, `.xml`, `.png`, `.jpg`, and `.jpeg`
