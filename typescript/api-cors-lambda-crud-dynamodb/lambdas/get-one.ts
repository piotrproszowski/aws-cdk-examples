// ============================================================================
// FUNKCJA LAMBDA: GET ONE ITEM (Pobieranie jednego elementu po ID)
// ============================================================================

// IMPORTY AWS SDK v3
import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";

// ============================================================================
// KONFIGURACJA
// ============================================================================

const TABLE_NAME = process.env.TABLE_NAME || ""; // Nazwa tabeli DynamoDB
const PRIMARY_KEY = process.env.PRIMARY_KEY || ""; // Nazwa pola klucza głównego

const db = DynamoDBDocument.from(new DynamoDB());

// ============================================================================
// GŁÓWNA FUNKCJA HANDLER
// ============================================================================

/**
 * Funkcja pobierająca jeden konkretny element z tabeli DynamoDB po ID.
 *
 * PRZEPŁYW WYKONANIA:
 * 1. Użytkownik wysyła: GET /items/{id} (np. GET /items/123)
 * 2. API Gateway przekazuje request z parametrem {id} w pathParameters
 * 3. Funkcja pobiera element o tym ID z DynamoDB
 * 4. Zwraca element (200) lub błąd 404 jeśli nie istnieje
 *
 * @param event - Obiekt z danymi requestu, zawiera pathParameters.id
 * @returns Promise<any> - Odpowiedź HTTP
 */
export const handler = async (event: any = {}): Promise<any> => {
  // ========================================================================
  // POBIERANIE I WALIDACJA PARAMETRU ID Z URL
  // ========================================================================

  // Wyciągamy ID z parametrów ścieżki URL
  // Dla /items/123 -> requestedItemId = "123"
  const requestedItemId = event.pathParameters.id;

  // Walidacja - czy ID zostało podane?
  if (!requestedItemId) {
    return {
      statusCode: 400, // HTTP 400 Bad Request
      body: `Error: You are missing the path parameter id`,
    };
  }

  // ========================================================================
  // PRZYGOTOWANIE ZAPYTANIA DO DYNAMODB
  // ========================================================================

  // Parametry dla operacji GET - pobieranie konkretnego rekordu
  const params = {
    TableName: TABLE_NAME,
    Key: {
      [PRIMARY_KEY]: requestedItemId, // Klucz główny = ID z URL
    },
  };

  // ========================================================================
  // POBIERANIE Z BAZY DANYCH
  // ========================================================================

  try {
    // GET - pobiera jeden konkretny rekord po kluczu głównym
    // To jest najszybsza operacja w DynamoDB (O(1) - stały czas)
    const response = await db.get(params);

    // Sprawdzamy czy element został znaleziony
    if (response.Item) {
      // Element istnieje - zwracamy go w formacie JSON
      return {
        statusCode: 200, // HTTP 200 OK
        body: JSON.stringify(response.Item),
      };
    } else {
      // Element nie istnieje - zwracamy 404
      return {
        statusCode: 404, // HTTP 404 Not Found (bez body)
      };
    }
  } catch (dbError) {
    // Błąd bazy danych
    console.error("DynamoDB Error:", dbError);
    return {
      statusCode: 500, // HTTP 500 Internal Server Error
      body: JSON.stringify(dbError),
    };
  }
};
