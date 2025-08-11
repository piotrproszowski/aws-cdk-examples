// ============================================================================
// IMPORTY - Tu importujemy wszystkie potrzebne klasy z AWS CDK
// ============================================================================

// API Gateway - do tworzenia REST API, integracji z Lambda i obsługi CORS
import {
  IResource,
  LambdaIntegration,
  MockIntegration,
  PassthroughBehavior,
  RestApi,
} from "aws-cdk-lib/aws-apigateway";

// DynamoDB - do tworzenia bazy danych NoSQL z kluczem partycyjnym
import { AttributeType, Table } from "aws-cdk-lib/aws-dynamodb";

// Lambda - definicja runtime (Node.js 20.x) dla funkcji Lambda
import { Runtime } from "aws-cdk-lib/aws-lambda";

// Podstawowe klasy CDK - App (aplikacja), Stack (stos zasobów), RemovalPolicy (polityka usuwania)
import { App, RemovalPolicy, Stack } from "aws-cdk-lib";

// NodejsFunction - specjalna klasa do tworzenia funkcji Lambda w TypeScript/JavaScript
import {
  NodejsFunction,
  NodejsFunctionProps,
} from "aws-cdk-lib/aws-lambda-nodejs";

// Standardowa funkcja Node.js do łączenia ścieżek plików
import { join } from "path";

// ============================================================================
// GŁÓWNA KLASA STACK - Tu definiujemy całą infrastrukturę AWS
// ============================================================================

/**
 * Stack to grupa logicznie powiązanych zasobów AWS, które są zarządzane jako jedna jednostka.
 * Wszystkie zasoby w tym Stack'u będą utworzone razem podczas 'cdk deploy'
 * i usunięte razem podczas 'cdk destroy'.
 */
export class ApiLambdaCrudDynamoDBStack extends Stack {
  constructor(app: App, id: string) {
    // Wywołujemy konstruktor klasy nadrzędnej (Stack) - to MUSI być pierwsze!
    super(app, id);

    // ========================================================================
    // KROK 1: TWORZENIE TABELI DYNAMODB
    // ========================================================================

    /**
     * DynamoDB to baza danych NoSQL firmy AWS.
     * Tabela potrzebuje:
     * - partition key (klucz główny) - tutaj 'itemId' typu STRING
     * - nazwę tabeli - tutaj 'items'
     * - politykę usuwania - tutaj DESTROY (usuwa tabelę podczas 'cdk destroy')
     */
    const dynamoTable = new Table(this, "items", {
      // Klucz partycyjny - unikalny identyfikator każdego rekordu w tabeli
      partitionKey: {
        name: "itemId", // nazwa pola klucza
        type: AttributeType.STRING, // typ danych - string (może być też NUMBER lub BINARY)
      },
      tableName: "items", // rzeczywista nazwa tabeli w AWS (widoczna w konsoli AWS)

      /**
       * POLITYKA USUWANIA - BARDZO WAŻNE!
       * - RETAIN (domyślna): tabela pozostanie w AWS nawet po 'cdk destroy'
       * - DESTROY: tabela zostanie usunięta wraz ze wszystkimi danymi podczas 'cdk destroy'
       *
       * W środowisku produkcyjnym NIGDY nie używaj DESTROY!
       */
      removalPolicy: RemovalPolicy.DESTROY, // ⚠️ UWAGA: Usuwa dane! Tylko dla testów!
    });

    // ========================================================================
    // KROK 2: KONFIGURACJA WSPÓLNA DLA WSZYSTKICH FUNKCJI LAMBDA
    // ========================================================================

    /**
     * NodejsFunctionProps to obiekt z konfiguracją dla funkcji Lambda napisanych w TypeScript/JavaScript.
     * Zamiast powtarzać tę samą konfigurację 5 razy, tworzymy ją raz i używamy wielokrotnie.
     */
    const nodeJsFunctionProps: NodejsFunctionProps = {
      // Konfiguracja bundlingu - jak CDK ma skompilować i spakować kod TypeScript
      bundling: {
        externalModules: [
          "aws-sdk", // Nie pakuj aws-sdk, bo jest już dostępny w środowisku Lambda runtime
        ],
      },
      // Ścieżka do package-lock.json dla funkcji Lambda (do zapewnienia powtarzalności instalacji)
      depsLockFilePath: join(__dirname, "lambdas", "package-lock.json"),

      // ZMIENNE ŚRODOWISKOWE - będą dostępne w kodzie Lambda jako process.env
      environment: {
        PRIMARY_KEY: "itemId", // Nazwa klucza głównego tabeli
        TABLE_NAME: dynamoTable.tableName, // Dynamiczna nazwa tabeli (CDK automatycznie wygeneruje)
      },

      // Wersja Node.js w środowisku Lambda
      runtime: Runtime.NODEJS_20_X, // AWS Lambda uruchomi nasze funkcje na Node.js 20.x
    };

    // ========================================================================
    // KROK 3: TWORZENIE 5 FUNKCJI LAMBDA (CRUD OPERATIONS)
    // ========================================================================

    /**
     * Tworzymy 5 funkcji Lambda, każda odpowiedzialna za jedną operację CRUD:
     * - CREATE: Tworzenie nowego elementu
     * - READ: Odczytanie elementu/elementów (getOne, getAll)
     * - UPDATE: Aktualizacja istniejącego elementu
     * - DELETE: Usunięcie elementu
     */

    // FUNKCJA 1: Pobieranie jednego elementu po ID (GET /items/{id})
    const getOneLambda = new NodejsFunction(this, "getOneItemFunction", {
      entry: join(__dirname, "lambdas", "get-one.ts"), // Ścieżka do pliku z kodem funkcji
      ...nodeJsFunctionProps, // Rozpakowanie wcześniej zdefiniowanej konfiguracji
    });

    // FUNKCJA 2: Pobieranie wszystkich elementów (GET /items)
    const getAllLambda = new NodejsFunction(this, "getAllItemsFunction", {
      entry: join(__dirname, "lambdas", "get-all.ts"),
      ...nodeJsFunctionProps,
    });

    // FUNKCJA 3: Tworzenie nowego elementu (POST /items)
    const createOneLambda = new NodejsFunction(this, "createItemFunction", {
      entry: join(__dirname, "lambdas", "create.ts"),
      ...nodeJsFunctionProps,
    });

    // FUNKCJA 4: Aktualizacja istniejącego elementu (PATCH /items/{id})
    const updateOneLambda = new NodejsFunction(this, "updateItemFunction", {
      entry: join(__dirname, "lambdas", "update-one.ts"),
      ...nodeJsFunctionProps,
    });

    // FUNKCJA 5: Usuwanie elementu (DELETE /items/{id})
    const deleteOneLambda = new NodejsFunction(this, "deleteItemFunction", {
      entry: join(__dirname, "lambdas", "delete-one.ts"),
      ...nodeJsFunctionProps,
    });

    // ========================================================================
    // KROK 4: NADAWANIE UPRAWNIEŃ - BARDZO WAŻNE!
    // ========================================================================

    /**
     * Domyślnie funkcje Lambda NIE MAJĄ uprawnień do DynamoDB.
     * Metoda grantReadWriteData() automatycznie:
     * 1. Tworzy IAM role dla każdej funkcji Lambda
     * 2. Dodaje policy, która pozwala na odczyt i zapis do konkretnej tabeli
     * 3. Łączy role z funkcjami Lambda
     *
     * To jest MAGIA CDK - zamiast ręcznie pisać złożone IAM policies!
     */
    dynamoTable.grantReadWriteData(getAllLambda); // getAll może czytać/pisać do tabeli
    dynamoTable.grantReadWriteData(getOneLambda); // getOne może czytać/pisać do tabeli
    dynamoTable.grantReadWriteData(createOneLambda); // create może czytać/pisać do tabeli
    dynamoTable.grantReadWriteData(updateOneLambda); // update może czytać/pisać do tabeli
    dynamoTable.grantReadWriteData(deleteOneLambda); // delete może czytać/pisać do tabeli

    // ========================================================================
    // KROK 5: TWORZENIE INTEGRACJI LAMBDA - POŁĄCZENIE API Z FUNKCJAMI
    // ========================================================================

    /**
     * LambdaIntegration to "most" między API Gateway a funkcją Lambda.
     * Każda integracja mówi API Gateway: "gdy przychodzi request na ten endpoint,
     * przekaż go do tej konkretnej funkcji Lambda".
     */
    const getAllIntegration = new LambdaIntegration(getAllLambda); // GET /items
    const createOneIntegration = new LambdaIntegration(createOneLambda); // POST /items
    const getOneIntegration = new LambdaIntegration(getOneLambda); // GET /items/{id}
    const updateOneIntegration = new LambdaIntegration(updateOneLambda); // PATCH /items/{id}
    const deleteOneIntegration = new LambdaIntegration(deleteOneLambda); // DELETE /items/{id}

    // ========================================================================
    // KROK 6: TWORZENIE API GATEWAY REST API
    // ========================================================================

    /**
     * RestApi tworzy publiczny endpoint HTTP, przez który zewnętrzne aplikacje
     * (np. frontend, mobile app) mogą komunikować się z naszym backendem.
     */
    const api = new RestApi(this, "itemsApi", {
      restApiName: "Items Service", // Nazwa widoczna w konsoli AWS
      // binaryMediaTypes: ["*/*"],  // Opcjonalnie: obsługa plików binarnych (zdjęcia, PDF, etc.)
    });

    // ========================================================================
    // KROK 7: KONFIGURACJA ENDPOINTÓW I METOD HTTP
    // ========================================================================

    /**
     * Struktura API:
     *
     * /items           <- kolekcja (wszystkie elementy)
     *   ├── GET        <- pobierz wszystkie elementy
     *   ├── POST       <- utwórz nowy element
     *   └── OPTIONS    <- preflight CORS request
     *
     * /items/{id}      <- pojedynczy element
     *   ├── GET        <- pobierz element po ID
     *   ├── PATCH      <- zaktualizuj element
     *   ├── DELETE     <- usuń element
     *   └── OPTIONS    <- preflight CORS request
     */

    // Endpoint dla kolekcji: /items
    const items = api.root.addResource("items");
    items.addMethod("GET", getAllIntegration); // GET /items -> getAllLambda
    items.addMethod("POST", createOneIntegration); // POST /items -> createOneLambda
    addCorsOptions(items); // Dodaj obsługę CORS dla tego endpointu

    // Endpoint dla pojedynczego elementu: /items/{id}
    // {id} to placeholder - rzeczywisty ID będzie w URL, np. /items/123
    const singleItem = items.addResource("{id}");
    singleItem.addMethod("GET", getOneIntegration); // GET /items/{id} -> getOneLambda
    singleItem.addMethod("PATCH", updateOneIntegration); // PATCH /items/{id} -> updateOneLambda
    singleItem.addMethod("DELETE", deleteOneIntegration); // DELETE /items/{id} -> deleteOneLambda
    addCorsOptions(singleItem); // Dodaj obsługę CORS dla tego endpointu
  }
}

// ============================================================================
// FUNKCJA POMOCNICZA - KONFIGURACJA CORS (Cross-Origin Resource Sharing)
// ============================================================================

/**
 * CORS umożliwia przeglądarkom internetowym wysyłanie requestów do naszego API
 * z różnych domen (np. localhost:3000 -> nasza-api.amazonaws.com).
 *
 * Bez CORS przeglądarka blokuje takie requesty ze względów bezpieczeństwa.
 *
 * Ta funkcja dodaje metodę OPTIONS, która odpowiada na "preflight requests" -
 * specjalne requesty, które przeglądarka wysyła przed właściwym requestem.
 */
export function addCorsOptions(apiResource: IResource) {
  apiResource.addMethod(
    "OPTIONS",
    new MockIntegration({
      // MockIntegration = sztuczna integracja, która nie wywołuje Lambda
      // Zwraca po prostu statyczną odpowiedź z nagłówkami CORS

      integrationResponses: [
        {
          statusCode: "200", // HTTP 200 OK
          responseParameters: {
            // CORS Headers - mówią przeglądarce co jest dozwolone:

            // Jakie nagłówki mogą być wysłane w requestach
            "method.response.header.Access-Control-Allow-Headers":
              "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",

            // Z jakich domen można wywoływać API (* = wszystkie domeny)
            // ⚠️ W produkcji ustaw konkretną domenę zamiast *
            "method.response.header.Access-Control-Allow-Origin": "'*'",

            // Czy przesyłać cookies/credentials (false = nie)
            "method.response.header.Access-Control-Allow-Credentials":
              "'false'",

            // Jakie metody HTTP są dozwolone
            "method.response.header.Access-Control-Allow-Methods":
              "'OPTIONS,GET,PUT,POST,DELETE'",
          },
        },
      ],

      // NEVER = nie przekazuj requestu dalej, odpowiedz od razu
      passthroughBehavior: PassthroughBehavior.NEVER,

      // Szablon odpowiedzi - zwraca po prostu statusCode 200
      requestTemplates: {
        "application/json": '{"statusCode": 200}',
      },
    }),
    {
      // Definicja jakie nagłówki mogą być zwrócone w odpowiedzi
      methodResponses: [
        {
          statusCode: "200",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Headers": true,
            "method.response.header.Access-Control-Allow-Methods": true,
            "method.response.header.Access-Control-Allow-Credentials": true,
            "method.response.header.Access-Control-Allow-Origin": true,
          },
        },
      ],
    }
  );
}

// ============================================================================
// URUCHAMIANIE APLIKACJI CDK
// ============================================================================

/**
 * To jest punkt wejścia aplikacji CDK.
 *
 * 1. Tworzymy instancję App (główna aplikacja CDK)
 * 2. Tworzymy instancję naszego Stack'a (z całą infrastrukturą)
 * 3. Wywołujemy app.synth() - CDK generuje CloudFormation template
 *
 * Gdy uruchomisz 'cdk deploy', CDK:
 * 1. Wykona ten kod
 * 2. Wygeneruje CloudFormation template
 * 3. Wyśle template do AWS CloudFormation
 * 4. CloudFormation utworzy wszystkie zasoby AWS
 */
const app = new App();
new ApiLambdaCrudDynamoDBStack(app, "ApiLambdaCrudDynamoDBExample");
app.synth(); // Generuj CloudFormation template
