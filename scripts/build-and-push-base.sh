#!/usr/bin/env bash
set -e

# ==============================================================================
# Script para compilar y publicar imágenes base multi-arquitectura en Docker Hub
# Usuario / Namespace: drvita1982
# ==============================================================================

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

DOCKER_USER="drvita1982"
TAG="latest"
BUILD_FRONTEND=false
BUILD_BACKEND=false
PUSH=true
PLATFORMS="linux/amd64,linux/arm64"

print_usage() {
    echo "Uso: $0 [OPCIONES]"
    echo ""
    echo "Opciones:"
    echo "  -a, --all        Compilar y publicar todas las imágenes base (Frontend y Backend)"
    echo "  -f, --frontend   Compilar y publicar únicamente la imagen base de Frontend"
    echo "  -b, --backend    Compilar y publicar únicamente la imagen base de Backend"
    echo "  -t, --tag <tag>  Especificar tag de imagen (por defecto: latest)"
    echo "  --no-push        Compilar localmente sin hacer push a Docker Hub"
    echo "  -h, --help       Mostrar esta ayuda"
    echo ""
    echo "Ejemplos:"
    echo "  $0 --all"
    echo "  $0 -f -t v1.0.0"
    echo "  $0 -b --no-push"
}

# Parse command line arguments
if [ $# -eq 0 ]; then
    BUILD_FRONTEND=true
    BUILD_BACKEND=true
fi

while [[ $# -gt 0 ]]; do
    case "$1" in
        -a|--all)
            BUILD_FRONTEND=true
            BUILD_BACKEND=true
            shift
            ;;
        -f|--frontend)
            BUILD_FRONTEND=true
            shift
            ;;
        -b|--backend)
            BUILD_BACKEND=true
            shift
            ;;
        -t|--tag)
            TAG="$2"
            shift 2
            ;;
        --no-push)
            PUSH=false
            shift
            ;;
        -h|--help)
            print_usage
            exit 0
            ;;
        *)
            echo "Opción desconocida: $1"
            print_usage
            exit 1
            ;;
    esac
done

# Initialize or select docker buildx builder
BUILDER_NAME="iqmx-builder"
if ! docker buildx inspect "$BUILDER_NAME" > /dev/null 2>&1; then
    echo "Creando builder de Docker buildx: $BUILDER_NAME..."
    docker buildx create --name "$BUILDER_NAME" --use || true
else
    docker buildx use "$BUILDER_NAME"
fi

BUILD_ACTION="--load"
if [ "$PUSH" = true ]; then
    BUILD_ACTION="--push"
fi

# Build Frontend Base Image
if [ "$BUILD_FRONTEND" = true ]; then
    FRONTEND_IMAGE="$DOCKER_USER/iqmx-frontend-base:$TAG"
    echo "================================================================"
    echo " Compilando Imagen Base Frontend: $FRONTEND_IMAGE"
    echo " Plataformas: $PLATFORMS | Push: $PUSH"
    echo "================================================================"

    if [ "$PUSH" = true ]; then
        docker buildx build \
            --platform "$PLATFORMS" \
            -t "$FRONTEND_IMAGE" \
            -f "$REPO_DIR/docker/Dockerfile.base.frontend" \
            --push \
            "$REPO_DIR"
    else
        docker buildx build \
            -t "$FRONTEND_IMAGE" \
            -f "$REPO_DIR/docker/Dockerfile.base.frontend" \
            --load \
            "$REPO_DIR"
    fi

    echo "✅ Frontend base compilado exitosamente: $FRONTEND_IMAGE"
fi

# Build Backend Base Image
if [ "$BUILD_BACKEND" = true ]; then
    BACKEND_IMAGE="$DOCKER_USER/iqmx-python-base:$TAG"
    echo "================================================================"
    echo " Compilando Imagen Base Backend (Python): $BACKEND_IMAGE"
    echo " Plataformas: $PLATFORMS | Push: $PUSH"
    echo "================================================================"

    if [ "$PUSH" = true ]; then
        docker buildx build \
            --platform "$PLATFORMS" \
            -t "$BACKEND_IMAGE" \
            -f "$REPO_DIR/docker/Dockerfile.base.backend" \
            --push \
            "$REPO_DIR"
    else
        docker buildx build \
            -t "$BACKEND_IMAGE" \
            -f "$REPO_DIR/docker/Dockerfile.base.backend" \
            --load \
            "$REPO_DIR"
    fi

    echo "✅ Backend base compilado exitosamente: $BACKEND_IMAGE"
fi

echo "================================================================"
echo " Proceso de build completado."
echo "================================================================"
