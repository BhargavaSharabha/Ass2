@echo off
echo Starting Crypto Price Streamer...

:: Check if dependencies are installed
if not exist "backend\node_modules" (
    echo Installing backend dependencies...
    cd backend && call pnpm install && cd ..
)
if not exist "frontend\node_modules" (
    echo Installing frontend dependencies...
    cd frontend && call pnpm install && cd ..
)

:: Install Playwright browsers
echo Installing Playwright browsers...
cd backend && call pnpm exec playwright install && cd ..

:: Start backend server
echo Starting backend server...
start cmd /k "cd backend && pnpm start"

:: Wait for backend to start
timeout /t 5 /nobreak > NUL

:: Start frontend server
echo Starting frontend server...
start cmd /k "cd frontend && pnpm dev"

echo.
echo Application started!
echo Open http://localhost:3000 in your browser
echo.

pause