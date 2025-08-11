// ============================================================================
// FUNKCJA LAMBDA: DELETE ONE ITEM (Usuwanie elementu)
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
 * Funkcja usuwająca element z tabeli DynamoDB po ID.
 *
 * PRZEPŁYW WYKONANIA:
 * 1. Użytkownik wysyła: DELETE /items/{id} (np. DELETE /items/123)
 * 2. API Gateway przekazuje request z parametrem {id} w pathParameters
 * 3. Funkcja usuwa element o tym ID z DynamoDB
 * 4. Zwraca status 200 OK (nawet jeśli element nie istniał)
 *
 * UWAGA: DynamoDB nie zgłasza błędu jeśli próbujemy usunąć nieistniejący element!
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

  // Parametry dla operacji DELETE - usuwanie konkretnego rekordu
  const params = {
    TableName: TABLE_NAME,
    Key: {
      [PRIMARY_KEY]: requestedItemId, // Klucz główny = ID z URL
    },
  };

  // ========================================================================
  // USUWANIE Z BAZY DANYCH
  // ========================================================================

  try {
    // DELETE - usuwa rekord o podanym kluczu głównym
    // UWAGA: Nie zwraca błędu nawet jeśli element nie istniał!
    await db.delete(params);

    // HTTP 200 OK - operacja zakończona sukcesem
    // (nie sprawdzamy czy element rzeczywiście istniał)
    return {
      statusCode: 200,
      body: "",
    };
  } catch (dbError) {
    // Błąd bazy danych (bardzo rzadki w przypadku DELETE)
    console.error("DynamoDB Error:", dbError);
    return {
      statusCode: 500, // HTTP 500 Internal Server Error
      body: JSON.stringify(dbError),
    };
  }
};
