# Scalable DevOps Microservices Architecture on Kubernetes

This repository contains a full-stack, DevOps-ready microservices project. It includes a React frontend, a Node.js/Express backend, and a MongoDB database, demonstrating a modern containerized application architecture.

## Architecture & API Flow
- **Frontend Service**: A React (Vite) Single Page Application (SPA).
- **Backend Service**: A Node.js REST API with Express.js.
- **Database**: A MongoDB instance storing application data.

### API Communication Flow
1. User accesses the React Frontend.
2. Frontend makes Axios HTTP requests (`GET`, `POST`) to the Backend Service.
3. Backend Service processes requests and communicates with MongoDB via Mongoose.
4. MongoDB returns data to the Backend, which sends it as a JSON response back to the Frontend to render on the UI.

## Project Structure
```
.
├── backend/            # Node.js, Express, Mongoose REST API
├── frontend/           # React (Vite) Application
├── k8s/                # Kubernetes Deployment & Service Manifests
├── docker-compose.yml  # Local Docker orchestration
└── README.md
```

## How to Run

### 1. Locally (Without Docker)
**Prerequisites**: Node.js and MongoDB installed locally.

**Backend**:
```bash
cd backend
npm install
# Create a .env file with MONGO_URI and PORT
npm start
```
**Frontend**:
```bash
cd frontend
npm install
npm run dev
```

### 2. With Docker Compose
**Prerequisites**: Docker Desktop installed.
This is the easiest way to spin up the entire stack.

```bash
docker-compose up --build
```
- Frontend will be available at: http://localhost:80 (or 3000 depending on docker setup)
- Backend API will be available at: http://localhost:5000
- MongoDB runs internally on port 27017

### 3. With Kubernetes
**Prerequisites**: Minikube, Docker Desktop with Kubernetes enabled, or a cloud K8s cluster. `kubectl` installed.

1. Start your Kubernetes cluster.
2. Apply the manifests:
```bash
kubectl apply -f k8s/mongodb-deployment.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
```
3. Check the status of pods and services:
```bash
kubectl get pods
kubectl get services
```
4. Access the application using the assigned NodePort IP and Port.

## CI/CD Pipeline
A GitHub Actions workflow is provided in `.github/workflows/ci-cd.yml` which automatically builds the Docker images for the frontend and backend on push, and pushes them to Docker Hub. (Note: Requires `DOCKER_USERNAME` and `DOCKER_PASSWORD` repository secrets).
