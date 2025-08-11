// ============================================================================
// FUNKCJA LAMBDA: CREATE ITEM (Tworzenie nowego elementu)
// ============================================================================

// IMPORTY AWS SDK v3
import { DynamoDB } from "@aws-sdk/client-dynamodb"; // Klient DynamoDB
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb"; // Wrapper dla DynamoDB

// IMPORT UUID - biblioteka do generowania unikalnych identyfikatorów
import { v4 as uuidv4 } from "uuid";

// ============================================================================
// KONFIGURACJA I STAŁE
// ============================================================================

// Zmienne środowiskowe ustawione przez CDK
const TABLE_NAME = process.env.TABLE_NAME || ""; // Nazwa tabeli DynamoDB
const PRIMARY_KEY = process.env.PRIMARY_KEY || ""; // Nazwa pola klucza głównego ('itemId')

// Klient DynamoDB
const db = DynamoDBDocument.from(new DynamoDB());

// Stałe komunikatów błędów
const RESERVED_RESPONSE = `Error: You're using AWS reserved keywords as attributes`;
const DYNAMODB_EXECUTION_ERROR = `Error: Execution update, caused a Dynamodb error, please take a look at your CloudWatch Logs.`;

// ============================================================================
// GŁÓWNA FUNKCJA HANDLER
// ============================================================================

/**
 * Funkcja tworząca nowy element w tabeli DynamoDB.
 *
 * PRZEPŁYW WYKONANIA:
 * 1. Użytkownik wysyła: POST /items z danymi w body
 * 2. API Gateway przekazuje request do tej funkcji Lambda
 * 3. Funkcja waliduje dane, generuje UUID, zapisuje do DynamoDB
 * 4. Zwraca status 201 (Created) lub błąd
 *
 * @param event - Obiekt z danymi requestu od API Gateway
 * @returns Promise<any> - Odpowiedź HTTP
 */
export const handler = async (event: any = {}): Promise<any> => {
  // ========================================================================
  // WALIDACJA DANYCH WEJŚCIOWYCH
  // ========================================================================

  // Sprawdzamy czy request ma body (dane do zapisania)
  if (!event.body) {
    return {
      statusCode: 400, // HTTP 400 Bad Request
      body: "invalid request, you are missing the parameter body",
    };
  }

  // ========================================================================
  // PRZYGOTOWANIE DANYCH DO ZAPISU
  // ========================================================================

  // Parsowanie JSON z body requestu
  // event.body może być stringiem JSON lub już sparsowanym obiektem
  const item =
    typeof event.body == "object" ? event.body : JSON.parse(event.body);

  // Automatyczne generowanie unikalnego ID dla nowego elementu
  // UUID v4 generuje losowy identyfikator, np: "123e4567-e89b-12d3-a456-426614174000"
  item[PRIMARY_KEY] = uuidv4();

  // Parametry dla operacji PUT w DynamoDB
  const params = {
    TableName: TABLE_NAME, // W jakiej tabeli zapisać
    Item: item, // Co zapisać (cały obiekt z danymi + wygenerowane ID)
  };

  // ========================================================================
  // ZAPIS DO BAZY DANYCH
  // ========================================================================

  try {
    // PUT - zapisuje nowy element do tabeli
    // Jeśli element z takim ID już istnieje, zostanie nadpisany
    await db.put(params);

    // Zwracamy HTTP 201 Created (bez zwracania danych - tylko potwierdzenie)
    return { statusCode: 201, body: "" };
  } catch (dbError: any) {
    // ========================================================================
    // OBSŁUGA BŁĘDÓW
    // ========================================================================

    console.error("DynamoDB Error:", dbError); // Log do CloudWatch

    // Sprawdzamy typ błędu i zwracamy odpowiedni komunikat
    const errorResponse =
      dbError.code === "ValidationException" &&
      dbError.message.includes("reserved keyword")
        ? RESERVED_RESPONSE
        : DYNAMODB_EXECUTION_ERROR;

    return {
      statusCode: 500, // HTTP 500 Internal Server Error
      body: errorResponse,
    };
  }
};
