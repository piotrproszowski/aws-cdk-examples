// ============================================================================
// FUNKCJA LAMBDA: UPDATE ONE ITEM (Aktualizacja istniejącego elementu)
// ============================================================================

// IMPORTY AWS SDK v3
import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";

// ============================================================================
// KONFIGURACJA I STAŁE
// ============================================================================

const TABLE_NAME = process.env.TABLE_NAME || "";
const PRIMARY_KEY = process.env.PRIMARY_KEY || "";

// Komunikaty błędów
const RESERVED_RESPONSE = `Error: You're using AWS reserved keywords as attributes`;
const DYNAMODB_EXECUTION_ERROR = `Error: Execution update, caused a Dynamodb error, please take a look at your CloudWatch Logs.`;

const db = DynamoDBDocument.from(new DynamoDB());

// ============================================================================
// GŁÓWNA FUNKCJA HANDLER
// ============================================================================

/**
 * Funkcja aktualizująca istniejący element w tabeli DynamoDB.
 *
 * PRZEPŁYW WYKONANIA:
 * 1. Użytkownik wysyła: PATCH /items/{id} z danymi do aktualizacji w body
 * 2. API Gateway przekazuje request z ID w pathParameters i dane w body
 * 3. Funkcja dinamicznie buduje UpdateExpression dla DynamoDB
 * 4. Wykonuje aktualizację tylko przesłanych pól (partial update)
 * 5. Zwraca status 204 No Content (sukces bez zwracania danych)
 *
 * @param event - Obiekt z danymi requestu
 * @returns Promise<any> - Odpowiedź HTTP
 */
export const handler = async (event: any = {}): Promise<any> => {
  // ========================================================================
  // WALIDACJA DANYCH WEJŚCIOWYCH
  // ========================================================================

  // Sprawdzenie czy przesłano dane do aktualizacji
  if (!event.body) {
    return {
      statusCode: 400,
      body: "invalid request, you are missing the parameter body",
    };
  }

  // Sprawdzenie czy przesłano ID elementu do aktualizacji
  const editedItemId = event.pathParameters.id;
  if (!editedItemId) {
    return {
      statusCode: 400,
      body: "invalid request, you are missing the path parameter id",
    };
  }

  // ========================================================================
  // PRZYGOTOWANIE DANYCH DO AKTUALIZACJI
  // ========================================================================

  // Parsowanie danych z body requestu
  const editedItem: any =
    typeof event.body == "object" ? event.body : JSON.parse(event.body);

  // Pobieranie listy pól do aktualizacji
  const editedItemProperties = Object.keys(editedItem);

  // Sprawdzenie czy przesłano jakiekolwiek dane
  if (!editedItem || editedItemProperties.length < 1) {
    return {
      statusCode: 400,
      body: "invalid request, no arguments provided",
    };
  }

  // ========================================================================
  // DYNAMICZNE BUDOWANIE UPDATEEXPRESSION
  // ========================================================================

  /**
   * DynamoDB wymaga specjalnej składni dla UPDATE:
   * UpdateExpression: "set field1 = :val1, field2 = :val2"
   * ExpressionAttributeValues: { ":val1": value1, ":val2": value2 }
   *
   * Budujemy to dynamicznie na podstawie przesłanych pól.
   */

  // Pobieramy pierwsze pole (potrzebne do inicjalizacji UpdateExpression)
  const firstProperty = editedItemProperties.splice(0, 1);

  // Podstawowe parametry zapytania
  const params: any = {
    TableName: TABLE_NAME,
    Key: {
      [PRIMARY_KEY]: editedItemId, // ID elementu do aktualizacji
    },
    // Rozpoczynamy UpdateExpression pierwszym polem
    UpdateExpression: `set ${firstProperty} = :${firstProperty}`,
    ExpressionAttributeValues: {}, // Tutaj będą wartości do podstawienia
    ReturnValues: "UPDATED_NEW", // Zwróć tylko zaktualizowane pola
  };

  // Dodajemy wartość pierwszego pola
  params.ExpressionAttributeValues[`:${firstProperty}`] =
    editedItem[`${firstProperty}`];

  // Dodajemy pozostałe pola (jeśli są)
  editedItemProperties.forEach((property) => {
    // Rozszerzamy UpdateExpression o kolejne pole
    params.UpdateExpression += `, ${property} = :${property}`;
    // Dodajemy wartość tego pola
    params.ExpressionAttributeValues[`:${property}`] = editedItem[property];
  });

  // ========================================================================
  // WYKONANIE AKTUALIZACJI
  // ========================================================================

  try {
    // UPDATE - aktualizuje tylko określone pola, pozostawia inne bez zmian
    await db.update(params);

    // HTTP 204 No Content - sukces, ale nie zwracamy danych
    return { statusCode: 204, body: "" };
  } catch (dbError: any) {
    console.error("DynamoDB Error:", dbError);

    // Obsługa różnych typów błędów
    const errorResponse =
      dbError.code === "ValidationException" &&
      dbError.message.includes("reserved keyword")
        ? RESERVED_RESPONSE
        : DYNAMODB_EXECUTION_ERROR;

    return { statusCode: 500, body: errorResponse };
  }
};
