#!/bin/bash

echo "Starting Crypto Price Streamer..."

# Install dependencies if needed
if [ ! -d "backend/node_modules" ]; then
    echo "Installing backend dependencies..."
    cd backend && pnpm install && cd ..
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "Installing frontend dependencies..."
    cd frontend && pnpm install && cd ..
fi

# Start backend server
echo "Starting backend server..."
cd backend && pnpm start &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 5

# Start frontend server
echo "Starting frontend server..."
cd frontend && pnpm dev &
FRONTEND_PID=$!
cd ..

echo "Application started!"
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo "Open http://localhost:3000 in your browser"

# Function to handle cleanup
cleanup() {
    echo "Shutting down servers..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}

# Set up trap to handle Ctrl+C
trap cleanup SIGINT

# Wait for processes
wait