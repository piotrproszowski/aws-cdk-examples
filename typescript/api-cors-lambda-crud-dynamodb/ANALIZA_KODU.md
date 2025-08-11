# 🎯 PRZEWODNIK ANALIZY KODU AWS CDK - PRZYKŁAD: API CORS LAMBDA CRUD DYNAMODB

## 📋 SPIS TREŚCI

1. [Przepływ wykonania całej aplikacji](#przepływ-wykonania)
2. [Architektura systemu](#architektura)
3. [Analiza krok po kroku](#analiza-krok-po-kroku)
4. [Jak kod się wykonuje](#jak-kod-się-wykonuje)
5. [Testowanie i debugowanie](#testowanie)

---

## 🔄 PRZEPŁYW WYKONANIA CAŁEJ APLIKACJI

### 1. DEPLOYMENT (CDK Deploy)

```
1. Uruchamiasz: cdk deploy
2. CDK czyta: index.ts
3. CDK tworzy: CloudFormation template
4. CloudFormation tworzy zasoby AWS:
   ├── DynamoDB Table (items)
   ├── 5x Lambda Functions
   ├── API Gateway REST API
   ├── IAM Roles & Policies
   └── CloudWatch Log Groups
```

### 2. RUNTIME (Gdy użytkownik wywołuje API)

```
User Request → API Gateway → Lambda Function → DynamoDB → Response
     ↓              ↓              ↓              ↓           ↓
  POST /items  →  Route Match  →  createLambda  →  PUT Item  →  201 Created
  GET /items   →  Route Match  →  getAllLambda  →  SCAN Table → 200 + Data
  GET /items/123 → Route Match → getOneLambda  → GET Item   → 200 + Item
  PATCH /items/123 → Route Match → updateLambda → UPDATE Item → 204 No Content
  DELETE /items/123 → Route Match → deleteLambda → DELETE Item → 200 OK
```

---

## 🏗️ ARCHITEKTURA SYSTEMU

```mermaid
graph TB
    User[👤 User/Frontend]

    subgraph "AWS Cloud"
        AG[🌐 API Gateway<br/>REST API]

        subgraph "Lambda Functions"
            L1[📄 getAllLambda<br/>GET /items]
            L2[📄 getOneLambda<br/>GET /items/{id}]
            L3[📄 createLambda<br/>POST /items]
            L4[📄 updateLambda<br/>PATCH /items/{id}]
            L5[📄 deleteLambda<br/>DELETE /items/{id}]
        end

        DB[(🗄️ DynamoDB<br/>items table)]

        subgraph "Security"
            IAM[🔐 IAM Roles<br/>& Policies]
        end

        CW[📊 CloudWatch<br/>Logs & Metrics]
    end

    User --> AG
    AG --> L1
    AG --> L2
    AG --> L3
    AG --> L4
    AG --> L5

    L1 --> DB
    L2 --> DB
    L3 --> DB
    L4 --> DB
    L5 --> DB

    IAM -.-> L1
    IAM -.-> L2
    IAM -.-> L3
    IAM -.-> L4
    IAM -.-> L5

    L1 --> CW
    L2 --> CW
    L3 --> CW
    L4 --> CW
    L5 --> CW
```

---

## 🔍 ANALIZA KROK PO KROKU

### KROK 1: TWORZENIE TABELI DYNAMODB

```typescript
// 📍 LOKALIZACJA: index.ts, linie ~40-60

const dynamoTable = new Table(this, "items", {
  partitionKey: { name: "itemId", type: AttributeType.STRING },
  tableName: "items",
  removalPolicy: RemovalPolicy.DESTROY,
});
```

**CO TO ROBI:**

- Tworzy tabelę NoSQL o nazwie `items`
- Klucz główny: `itemId` (string)
- Polityka: usuń tabelę gdy usuwasz stack

**DLACZEGO TAK:**

- DynamoDB potrzebuje klucza głównego dla każdej tabeli
- RemovalPolicy.DESTROY ułatwia testowanie (ale NIE dla produkcji!)

### KROK 2: KONFIGURACJA LAMBDA

```typescript
// 📍 LOKALIZACJA: index.ts, linie ~62-80

const nodeJsFunctionProps: NodejsFunctionProps = {
  environment: {
    PRIMARY_KEY: "itemId",
    TABLE_NAME: dynamoTable.tableName,
  },
  runtime: Runtime.NODEJS_20_X,
};
```

**CO TO ROBI:**

- Definiuje wspólną konfigurację dla wszystkich Lambda
- Ustawia zmienne środowiskowe (dostępne jako process.env)
- Określa runtime (Node.js 20.x)

**DLACZEGO TAK:**

- DRY principle - nie powtarzamy konfiguracji
- Zmienne środowiskowe pozwalają na dynamiczne przekazywanie nazw zasobów

### KROK 3: TWORZENIE FUNKCJI LAMBDA

```typescript
// 📍 LOKALIZACJA: index.ts, linie ~95-125

const getOneLambda = new NodejsFunction(this, "getOneItemFunction", {
  entry: join(__dirname, "lambdas", "get-one.ts"),
  ...nodeJsFunctionProps,
});
```

**CO TO ROBI:**

- Tworzy funkcję Lambda z kodu w `lambdas/get-one.ts`
- Automatycznie kompiluje TypeScript → JavaScript
- Dodaje wspólną konfigurację

**DLACZEGO TAK:**

- NodejsFunction automatycznie obsługuje TypeScript
- Każda operacja CRUD ma osobną funkcję (Single Responsibility)

### KROK 4: NADAWANIE UPRAWNIEŃ

```typescript
// 📍 LOKALIZACJA: index.ts, linie ~149-153

dynamoTable.grantReadWriteData(getAllLambda);
dynamoTable.grantReadWriteData(getOneLambda);
// ... inne funkcje
```

**CO TO ROBI:**

- Automatycznie tworzy IAM role dla Lambda
- Dodaje uprawnienia do czytania/pisania tabeli DynamoDB
- Łączy role z funkcjami

**DLACZEGO TAK:**

- CDK abstrakcja - nie musisz ręcznie pisać IAM policies
- Principle of least privilege - tylko potrzebne uprawnienia

### KROK 5: TWORZENIE API GATEWAY

```typescript
// 📍 LOKALIZACJA: index.ts, linie ~175-195

const api = new RestApi(this, "itemsApi", {
  restApiName: "Items Service",
});

const items = api.root.addResource("items");
items.addMethod("GET", getAllIntegration);
items.addMethod("POST", createOneIntegration);
```

**CO TO ROBI:**

- Tworzy publiczny REST API endpoint
- Definiuje strukturę URL: `/items` i `/items/{id}`
- Łączy HTTP metody z funkcjami Lambda

**DLACZEGO TAK:**

- RESTful design - jasna struktura API
- API Gateway obsługuje routing, autoryzację, throttling automatycznie

---

## ⚡ JAK KOD SIĘ WYKONUJE

### SCENARIUSZ 1: Tworzenie nowego elementu (POST /items)

```
1. 🌐 USER: POST /items
   Body: {"name": "Laptop", "price": 1500}

2. 🚀 API GATEWAY:
   - Sprawdza routing table
   - Znajduje: POST /items → createOneIntegration
   - Wywołuje: createOneLambda

3. 📄 LAMBDA createOneLambda (create.ts):
   - Pobiera dane z event.body
   - Generuje UUID: itemId = "abc-123-def"
   - Przygotowuje params dla DynamoDB:
     {
       TableName: "items",
       Item: {
         itemId: "abc-123-def",
         name: "Laptop",
         price: 1500
       }
     }

4. 🗄️ DYNAMODB:
   - Wykonuje PUT operation
   - Zapisuje rekord w tabeli

5. 📄 LAMBDA:
   - Zwraca: { statusCode: 201, body: '' }

6. 🌐 API GATEWAY:
   - Dodaje CORS headers
   - Zwraca odpowiedź do użytkownika

7. 👤 USER:
   - Otrzymuje: HTTP 201 Created
```

### SCENARIUSZ 2: Pobieranie wszystkich elementów (GET /items)

```
1. 🌐 USER: GET /items

2. 🚀 API GATEWAY:
   - Routing: GET /items → getAllIntegration
   - Wywołuje: getAllLambda

3. 📄 LAMBDA getAllLambda (get-all.ts):
   - Przygotowuje params: { TableName: "items" }
   - Wykonuje: db.scan(params)

4. 🗄️ DYNAMODB:
   - SCAN operation (pobiera wszystkie rekordy)
   - Zwraca: { Items: [...] }

5. 📄 LAMBDA:
   - Zwraca: { statusCode: 200, body: JSON.stringify(Items) }

6. 👤 USER:
   - Otrzymuje: HTTP 200 + JSON array z wszystkimi elementami
```

### SCENARIUSZ 3: Aktualizacja elementu (PATCH /items/abc-123-def)

```
1. 🌐 USER: PATCH /items/abc-123-def
   Body: {"price": 1200}

2. 🚀 API GATEWAY:
   - Routing: PATCH /items/{id} → updateOneIntegration
   - pathParameters: { id: "abc-123-def" }
   - Wywołuje: updateOneLambda

3. 📄 LAMBDA updateOneLambda (update-one.ts):
   - Pobiera ID z event.pathParameters.id
   - Parsuje dane z event.body
   - Buduje UpdateExpression dynamicznie:
     "set price = :price"
   - ExpressionAttributeValues: { ":price": 1200 }

4. 🗄️ DYNAMODB:
   - UPDATE operation (tylko określone pola)
   - Aktualizuje rekord

5. 📄 LAMBDA:
   - Zwraca: { statusCode: 204, body: '' }

6. 👤 USER:
   - Otrzymuje: HTTP 204 No Content
```

---

## 🔧 TESTOWANIE I DEBUGOWANIE

### Jak testować lokalnie:

```bash
# 1. Zainstaluj zależności
cd typescript/api-cors-lambda-crud-dynamodb
npm install

# 2. Zbuduj projekt
npm run build

# 3. Zobacz wygenerowany CloudFormation
cdk synth

# 4. Deploy do AWS
cdk deploy

# 5. Testuj API (przykład z curl)
curl -X POST https://your-api-id.execute-api.region.amazonaws.com/prod/items \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Item","description":"Test description"}'
```

### Jak debugować problemy:

1. **CloudWatch Logs**:

   - AWS Console → CloudWatch → Log Groups
   - Szukaj grup: `/aws/lambda/ApiLambdaCrudDynamoDBExample-*`

2. **DynamoDB Console**:

   - AWS Console → DynamoDB → Tables → items
   - Sprawdź czy dane są zapisywane

3. **API Gateway Console**:
   - AWS Console → API Gateway → Items Service
   - Test tab - możesz testować endpointy

### Popularne problemy i rozwiązania:

| Problem            | Przyczyna                         | Rozwiązanie                      |
| ------------------ | --------------------------------- | -------------------------------- |
| 403 Forbidden      | Brak uprawnień Lambda do DynamoDB | Sprawdź `grantReadWriteData()`   |
| 500 Internal Error | Błąd w kodzie Lambda              | Sprawdź CloudWatch Logs          |
| CORS Error         | Brak nagłówków CORS               | Sprawdź `addCorsOptions()`       |
| 404 Not Found      | Błędny URL/routing                | Sprawdź konfigurację API Gateway |

---

## 🎓 KLUCZOWE WZORCE DO ZAPAMIĘTANIA

1. **Infrastructure as Code**: Cała infrastruktura w kodzie TypeScript
2. **Event-Driven**: Lambda reaguje na eventy z API Gateway
3. **Serverless**: Brak serwerów do zarządzania
4. **Microservices**: Każda operacja = osobna funkcja Lambda
5. **NoSQL**: DynamoDB - klucz-wartość, bez schematów
6. **RESTful API**: Jasna struktura URL i HTTP metod
7. **Automatic Scaling**: Lambda i DynamoDB skalują się automatycznie
8. **Pay-per-use**: Płacisz tylko za rzeczywiste użycie

---

## 💡 NASTĘPNE KROKI DO NAUKI

Po zrozumieniu tego przykładu, przejdź do:

1. **`static-site`** - Prostszy przykład (S3 + CloudFront)
2. **`lambda-cron`** - Zaplanowane zadania
3. **`ecs`** - Kontenery Docker na AWS
4. **`stepfunctions-job-poller`** - Orkiestracja workflow
5. **`codepipeline-build-deploy`** - CI/CD pipeline
