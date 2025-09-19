@echo off
echo Starting Crypto Price Streamer...

:: Check if dependencies are installed
if not exist "node_modules" (
    echo Installing dependencies...
    call pnpm install --recursive
)
if not exist "backend\node_modules" (
    echo Installing backend dependencies...
    cd backend && call pnpm install && cd ..
)
if not exist "frontend\node_modules" (
    echo Installing frontend dependencies...
    cd frontend && call pnpm install && cd ..
)

:: Generate protobuf files
echo Generating protobuf files...
cd backend && call npx buf generate ../proto 2>NUL && cd ..
cd frontend && call npx buf generate ../proto 2>NUL && cd ..

:: Start backend server
echo Starting backend server...
start /B cmd /c "cd backend && pnpm start"

:: Wait for backend to start
timeout /t 5 /nobreak > NUL

:: Start frontend server
echo Starting frontend server...
start /B cmd /c "cd frontend && pnpm dev"

echo.
echo Application started!
echo Open http://localhost:3000 in your browser
echo Press Ctrl+C to stop the servers
echo.

:: Keep the window open
pause > NUL