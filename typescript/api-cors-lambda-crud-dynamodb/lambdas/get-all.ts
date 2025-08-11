// ============================================================================
// FUNKCJA LAMBDA: GET ALL ITEMS (Pobieranie wszystkich elementów)
// ============================================================================

// IMPORTY AWS SDK v3 - nowa, modularna wersja SDK
import { DynamoDB } from "@aws-sdk/client-dynamodb"; // Low-level klient DynamoDB
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb"; // High-level wrapper dla DynamoDB

// ============================================================================
// KONFIGURACJA I INICJALIZACJA
// ============================================================================

// Pobieranie nazwy tabeli ze zmiennych środowiskowych
// CDK automatycznie ustawia tę zmienną podczas tworzenia funkcji Lambda
const TABLE_NAME = process.env.TABLE_NAME || "";

// Tworzenie klienta DynamoDB
// DynamoDBDocument to "wrapper" który ułatwia pracę z DynamoDB:
// - Automatycznie konwertuje typy JavaScript <-> DynamoDB
// - Upraszcza składnię zapytań
const db = DynamoDBDocument.from(new DynamoDB());

// ============================================================================
// GŁÓWNA FUNKCJA HANDLER
// ============================================================================

/**
 * To jest główna funkcja, która zostanie wywołana gdy przyjdzie request.
 *
 * PRZEPŁYW WYKONANIA:
 * 1. Użytkownik wysyła: GET /items
 * 2. API Gateway przekazuje request do tej funkcji Lambda
 * 3. Funkcja wykonuje scan na tabeli DynamoDB (pobiera wszystkie rekordy)
 * 4. Zwraca rezultat w formacie JSON
 *
 * @returns Promise<any> - Odpowiedź HTTP z statusCode i body
 */
export const handler = async (): Promise<any> => {
  // Parametry dla operacji scan - pobieranie wszystkich rekordów z tabeli
  const params = {
    TableName: TABLE_NAME, // Nazwa tabeli DynamoDB
  };

  try {
    // SCAN - pobiera WSZYSTKIE rekordy z tabeli
    // ⚠️ UWAGA: scan może być kosztowny dla dużych tabel!
    // W produkcji rozważ paginację lub użycie query zamiast scan
    const response = await db.scan(params);

    // Zwracamy sukces HTTP 200 z danymi w formacie JSON
    return {
      statusCode: 200,
      body: JSON.stringify(response.Items), // Items = array wszystkich rekordów
    };
  } catch (dbError) {
    // Jeśli coś poszło nie tak z bazą danych, zwracamy błąd HTTP 500
    console.error("DynamoDB Error:", dbError); // Loguj błąd do CloudWatch
    return {
      statusCode: 500,
      body: JSON.stringify(dbError),
    };
  }
};
