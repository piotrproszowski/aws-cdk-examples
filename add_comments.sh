#!/bin/bash

# 🔧 SKRYPT DODAWANIA KOMENTARZY DO PRZYKŁADÓW CDK
# Ten skrypt automatycznie dodaje szczegółowe komentarze do wybranych przykładów

echo "🎯 DODAWANIE KOMENTARZY DO PRZYKŁADÓW AWS CDK"
echo "============================================"

# Sprawdzenie czy jesteś w odpowiednim katalogu
if [ ! -d "typescript" ]; then
    echo "❌ Błąd: Nie znaleziono katalogu 'typescript'"
    echo "Przejdź do katalogu aws-cdk-examples"
    exit 1
fi

cd typescript

# Lista przykładów do przetworzenia (od prostych do zaawansowanych)
EXAMPLES=(
    "static-site-basic"
    "lambda-cron" 
    "ec2-instance"
    "application-load-balancer"
    "appsync-graphql-dynamodb"
    "ecs"
    "eventbridge-lambda"
    "stepfunctions-job-poller"
)

# Funkcja dodająca nagłówek z komentarzami do pliku
add_header_comments() {
    local file=$1
    local description=$2
    
    # Sprawdź czy plik już ma komentarze
    if head -5 "$file" | grep -q "============================================================================"; then
        echo "  ⏭️  Plik już ma komentarze: $file"
        return
    fi
    
    # Utwórz tymczasowy plik z komentarzami
    cat > /tmp/header_comment.txt << EOF
// ============================================================================
// $description
// ============================================================================
// Ten plik został automatycznie okomentowany dla łatwiejszego zrozumienia
// Dodano: $(date '+%Y-%m-%d %H:%M:%S')
// ============================================================================

EOF
    
    # Dodaj komentarze na początku pliku
    cat /tmp/header_comment.txt "$file" > /tmp/commented_file.txt
    mv /tmp/commented_file.txt "$file"
    
    echo "  ✅ Dodano komentarze do: $file"
}

# Funkcja analizująca i komentująca konkretny przykład
process_example() {
    local example_dir=$1
    
    if [ ! -d "$example_dir" ]; then
        echo "⏭️  Pomijam (nie istnieje): $example_dir"
        return
    fi
    
    echo ""
    echo "📁 Przetwarzam przykład: $example_dir"
    echo "────────────────────────────────"
    
    cd "$example_dir"
    
    # Dodaj komentarze do głównego pliku CDK
    if [ -f "index.ts" ]; then
        add_header_comments "index.ts" "GŁÓWNY PLIK INFRASTRUKTURY CDK - $example_dir"
    fi
    
    if [ -d "bin" ]; then
        for bin_file in bin/*.ts; do
            if [ -f "$bin_file" ]; then
                add_header_comments "$bin_file" "PUNKT WEJŚCIA APLIKACJI CDK - $example_dir"
            fi
        done
    fi
    
    if [ -d "lib" ]; then
        for lib_file in lib/*.ts; do
            if [ -f "$lib_file" ]; then
                add_header_comments "$lib_file" "BIBLIOTEKA KONSTRUKCJI CDK - $example_dir"
            fi
        done
    fi
    
    # Dodaj komentarze do funkcji Lambda
    if [ -d "lambda" ] || [ -d "lambdas" ] || [ -d "src" ]; then
        lambda_dirs=("lambda" "lambdas" "src")
        for lambda_dir in "${lambda_dirs[@]}"; do
            if [ -d "$lambda_dir" ]; then
                for lambda_file in "$lambda_dir"/*.ts "$lambda_dir"/*.js; do
                    if [ -f "$lambda_file" ]; then
                        add_header_comments "$lambda_file" "FUNKCJA LAMBDA - $example_dir"
                    fi
                done
            fi
        done
    fi
    
    # Utwórz plik README z analizą (jeśli nie istnieje)
    if [ ! -f "ANALIZA_KODU.md" ]; then
        cat > ANALIZA_KODU.md << EOF
# 📊 ANALIZA PRZYKŁADU: $example_dir

## 🎯 Cel przykładu
$(if [ -f README.md ]; then head -5 README.md | tail -3; else echo "Brak opisu - sprawdź README.md"; fi)

## 🏗️ Architektura
- **Główny plik**: $(if [ -f index.ts ]; then echo "index.ts"; elif [ -d bin ]; then echo "bin/*.ts"; else echo "lib/*.ts"; fi)
- **Serwisy AWS**: $(if [ -f index.ts ]; then grep -o "aws-cdk-lib/aws-[a-z-]*" index.ts 2>/dev/null | sed 's/aws-cdk-lib\/aws-//' | sort | uniq | head -5 | tr '\n' ', '; fi)

## 📁 Struktura plików
\`\`\`
$(find . -name "*.ts" -o -name "*.js" -o -name "*.json" | grep -E '\.(ts|js|json)$' | head -10)
\`\`\`

## 🔄 Przepływ wykonania
1. **Deploy**: \`cdk deploy\`
2. **Główne komponenty**:
$(if [ -f index.ts ]; then grep "new [A-Z][a-zA-Z]*(" index.ts 2>/dev/null | sed 's/.*new /   - /' | sed 's/(.*$//' | head -5; fi)

## 🚀 Jak uruchomić
\`\`\`bash
cd typescript/$example_dir
npm install
npm run build
cdk synth    # Zobacz wygenerowany CloudFormation
cdk deploy   # Deploy do AWS
cdk destroy  # Usuń zasoby
\`\`\`

## 🔍 Kluczowe wzorce
- **Infrastructure as Code**: Definicja infrastruktury w TypeScript
- **AWS CDK**: Wysokopoziomowe konstrukty zamiast surowego CloudFormation
- **Best Practices**: $(if grep -q "RemovalPolicy" index.ts 2>/dev/null; then echo "Polityki usuwania zasobów"; fi)

## 💡 Czego się nauczysz
- Jak używać CDK do tworzenia infrastruktury AWS
- Wzorce projektowe dla cloud applications
- Integracja różnych serwisów AWS
- Najlepsze praktyki bezpieczeństwa i wydajności

---
*Plik wygenerowany automatycznie: $(date)*
EOF
        echo "  📄 Utworzono ANALIZA_KODU.md"
    fi
    
    cd ..
}

# Menu główne
show_menu() {
    echo ""
    echo "Co chcesz zrobić?"
    echo "1. Dodaj komentarze do wszystkich podstawowych przykładów"
    echo "2. Dodaj komentarze do konkretnego przykładu" 
    echo "3. Pokaż listę przykładów do przetworzenia"
    echo "4. Analizuj przykład bez dodawania komentarzy"
    echo "5. Wyjście"
    echo ""
    read -p "Wybierz opcję (1-5): " choice
    
    case $choice in
        1)
            echo ""
            echo "🔄 Przetwarzam podstawowe przykłady..."
            for example in "${EXAMPLES[@]}"; do
                process_example "$example"
            done
            echo ""
            echo "✅ Zakończono dodawanie komentarzy!"
            ;;
        2)
            echo ""
            echo "Dostępne przykłady:"
            ls -d */ | sed 's|/||' | nl
            echo ""
            read -p "Podaj nazwę przykładu: " example_name
            if [ -d "$example_name" ]; then
                process_example "$example_name"
            else
                echo "❌ Nie znaleziono przykładu: $example_name"
            fi
            ;;
        3)
            echo ""
            echo "📋 PRZYKŁADY DO PRZETWORZENIA:"
            echo "============================="
            for example in "${EXAMPLES[@]}"; do
                if [ -d "$example" ]; then
                    echo "  ✅ $example"
                else
                    echo "  ❌ $example (nie istnieje)"
                fi
            done
            ;;
        4)
            echo ""
            read -p "Podaj nazwę przykładu do analizy: " example_name
            if [ -d "$example_name" ]; then
                echo ""
                echo "📊 ANALIZA: $example_name"
                echo "======================"
                cd "$example_name"
                
                echo "📁 Struktura:"
                find . -name "*.ts" -o -name "*.js" -o -name "*.json" | head -10
                echo ""
                
                echo "⚡ Serwisy AWS:"
                if [ -f "index.ts" ]; then
                    grep -o "aws-cdk-lib/aws-[a-z-]*" index.ts 2>/dev/null | sed 's/aws-cdk-lib\/aws-//' | sort | uniq | head -5
                fi
                echo ""
                
                echo "🏗️ Główne konstrukty:"
                if [ -f "index.ts" ]; then
                    grep "new [A-Z][a-zA-Z]*(" index.ts 2>/dev/null | sed 's/.*new //' | sed 's/(.*$//' | sort | uniq | head -5
                fi
                
                cd ..
            else
                echo "❌ Nie znaleziono przykładu: $example_name"
            fi
            ;;
        5)
            echo "👋 Do zobaczenia!"
            exit 0
            ;;
        *)
            echo "❌ Nieprawidłowa opcja"
            ;;
    esac
}

# Główna pętla
while true; do
    show_menu
    echo ""
    read -p "Naciśnij Enter aby kontynuować..."
    clear
done
