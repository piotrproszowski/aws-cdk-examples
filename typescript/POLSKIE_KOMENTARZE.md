# Polskie komentarze w przykładach AWS CDK TypeScript

Ten folder zawiera przykłady AWS CDK z dodanymi polskimi komentarzami wyjaśniającymi działanie kodu.

## Skomentowane przykłady

### Hosting i strony internetowe
- `amplify-console-app/index.ts` - Hosting aplikacji Amplify z GitHub
- `static-site-basic/index.ts` + `static-site-basic.ts` - Statyczna strona na S3

### API i bazy danych
- `api-cors-lambda-crud-dynamodb/index.ts` - Kompleksny CRUD API z Lambda, DynamoDB i CORS

### Funkcje i harmonogramowanie
- `lambda-cron/index.ts` - Funkcja Lambda uruchamiana przez cron
- `eventbridge-lambda/index.ts` - EventBridge + Lambda + SNS

### Bezpieczeństwo
- `secrets-manager-rotation/index.ts` - Automatyczna rotacja sekretów dla Redis

### Infrastruktura i storage
- `fsx-ad/index.ts` - Active Directory z systemem plików FSx
- `ecs/fargate-service-with-efs/index.ts` - Kontener Fargate z EFS

### Wzorce CDK
- `custom-logical-names/index.ts` + `base-stack.ts` - Niestandardowe nazwy logiczne

## Co wyjaśniają komentarze

### Importy
- Jakie moduły AWS CDK są importowane i do czego służą
- Różnica między różnymi sposobami importowania

### Konstruktory i parametry
- Co oznaczają parametry w konstruktorach
- Jak działają scope, id i props
- Różnice między różnymi typami stacków

### Zasoby AWS
- Jak konfigurować zasoby AWS
- Co oznaczają konkretne parametry
- Dlaczego używane są określone wartości

### Wzorce bezpieczeństwa
- Jak działają uprawnienia IAM
- Konfiguracja grup bezpieczeństwa
- VPC Endpoints i ich zastosowanie

### Integracje
- Jak łączyć różne usługi AWS
- Przekazywanie referencji między zasobami
- Zmienne środowiskowe i sekrety

## Jak korzystać z komentarzy

1. **Nauka podstaw**: Zacznij od prostych przykładów jak `amplify-console-app`
2. **Zrozum wzorce**: Przeanalizuj `custom-logical-names` aby zrozumieć dziedziczenie
3. **Integracje**: Przejdź do `api-cors-lambda-crud-dynamodb` dla kompleksnych przykładów
4. **Zaawansowane**: Przeanalizuj `secrets-manager-rotation` dla wzorców bezpieczeństwa

## Budowanie przykładów

Każdy przykład można zbudować niezależnie:

```bash
cd nazwa-przykładu
npm install
npm run build
```

Komentarze nie wpływają na funkcjonalność kodu - wszystkie przykłady działają tak samo jak przed dodaniem komentarzy.