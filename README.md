# Tably

Convert sheet music to guitar tab!

## Run the app

Install the backend dependencies:

```bash
cd Back-End
poetry install --only main
```

Install frontend dependencies:

```bash
cd Front-End
npm install
```

From project root, start the backend and frontend together with:

```bash
./run_dev.sh
```

This starts:

- the backend api at `http://localhost:8000`
- the frontend dev server at `http://localhost:5173`

## Test in the browser

1. Run `./run_dev.sh`
2. Open `http://localhost:5173`
3. Upload one of these file types:
   `.mscz`, `.musicxml`, `.xml`, `.png`, `.jpg`, `.jpeg`
4. The app should download a `.musicxml` file after conversion

## Test the backend directly

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

## Run only the backend

If you only want the api without the frontend:

```bash
cd Back-End
poetry run python main.py
```

## Notes

- image uploads use `homr`, so the first image request may take longer while models initialize
- `.mscz` conversion depends on museScore being installed at `/Applications/MuseScore 4.app/Contents/MacOS/mscore`
- supported upload types are `.mscz`, `.musicxml`, `.xml`, `.png`, `.jpg`, and `.jpeg`
