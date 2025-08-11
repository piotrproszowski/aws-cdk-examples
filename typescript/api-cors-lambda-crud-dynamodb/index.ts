// Importujemy klasy API Gateway - IResource (interfejs zasobu), LambdaIntegration (integracja z Lambda),
// MockIntegration (symulowana integracja), PassthroughBehavior (zachowanie przekazywania), RestApi (REST API)
import { IResource, LambdaIntegration, MockIntegration, PassthroughBehavior, RestApi } from 'aws-cdk-lib/aws-apigateway';
// Importujemy klasy DynamoDB - AttributeType (typ atrybutu), Table (tabela)
import { AttributeType, Table } from 'aws-cdk-lib/aws-dynamodb';
// Importujemy Runtime - środowisko uruchomieniowe dla funkcji Lambda
import { Runtime } from 'aws-cdk-lib/aws-lambda';
// Importujemy podstawowe klasy CDK - App (aplikacja), Stack (stack), RemovalPolicy (polityka usuwania)
import { App, Stack, RemovalPolicy } from 'aws-cdk-lib';
// Importujemy NodejsFunction - funkcje Lambda w Node.js z automatycznym bundlowaniem
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
// Importujemy funkcję join do łączenia ścieżek plików
import { join } from 'path'

// Stack implementujący API CRUD z Lambda i DynamoDB
export class ApiLambdaCrudDynamoDBStack extends Stack {
  constructor(app: App, id: string) {
    super(app, id);

    // Tworzymy tabelę DynamoDB do przechowywania elementów
    const dynamoTable = new Table(this, 'items', {
      partitionKey: {
        name: 'itemId', // Nazwa klucza głównego - identyfikuje unikat element
        type: AttributeType.STRING // Typ klucza - tekst
      },
      tableName: 'items', // Nazwa tabeli w DynamoDB

      /**
       * Domyślna polityka usuwania to RETAIN - tabela pozostanie po 'cdk destroy'
       * DESTROY oznacza, że 'cdk destroy' usunie tabelę (nawet z danymi)
       */
      removalPolicy: RemovalPolicy.DESTROY, // NIE zalecane w kodzie produkcyjnym
    });

    // Wspólne właściwości dla wszystkich funkcji Lambda Node.js
    const nodeJsFunctionProps: NodejsFunctionProps = {
      bundling: {
        externalModules: [
          'aws-sdk', // Używaj 'aws-sdk' dostępnego w środowisku Lambda (nie bundluj)
        ],
      },
      depsLockFilePath: join(__dirname, 'lambdas', 'package-lock.json'), // Ścieżka do pliku lock zależności
      environment: {
        PRIMARY_KEY: 'itemId', // Zmienna środowiskowa - nazwa klucza głównego
        TABLE_NAME: dynamoTable.tableName, // Zmienna środowiskowa - nazwa tabeli
      },
      runtime: Runtime.NODEJS_20_X, // Środowisko uruchomieniowe - Node.js 20.x
    }

    // Tworzymy funkcje Lambda dla każdej operacji CRUD

    // Funkcja do pobierania jednego elementu (GET /items/{id})
    const getOneLambda = new NodejsFunction(this, 'getOneItemFunction', {
      entry: join(__dirname, 'lambdas', 'get-one.ts'), // Ścieżka do kodu źródłowego
      ...nodeJsFunctionProps, // Rozpakowujemy wspólne właściwości
    });
    // Funkcja do pobierania wszystkich elementów (GET /items)
    const getAllLambda = new NodejsFunction(this, 'getAllItemsFunction', {
      entry: join(__dirname, 'lambdas', 'get-all.ts'),
      ...nodeJsFunctionProps,
    });
    // Funkcja do tworzenia nowego elementu (POST /items)
    const createOneLambda = new NodejsFunction(this, 'createItemFunction', {
      entry: join(__dirname, 'lambdas', 'create.ts'),
      ...nodeJsFunctionProps,
    });
    // Funkcja do aktualizacji elementu (PATCH /items/{id})
    const updateOneLambda = new NodejsFunction(this, 'updateItemFunction', {
      entry: join(__dirname, 'lambdas', 'update-one.ts'),
      ...nodeJsFunctionProps,
    });
    // Funkcja do usuwania elementu (DELETE /items/{id})
    const deleteOneLambda = new NodejsFunction(this, 'deleteItemFunction', {
      entry: join(__dirname, 'lambdas', 'delete-one.ts'),
      ...nodeJsFunctionProps,
    });

    // Przyznajemy funkcjom Lambda uprawnienia do odczytu i zapisu w tabeli DynamoDB
    dynamoTable.grantReadWriteData(getAllLambda);
    dynamoTable.grantReadWriteData(getOneLambda);
    dynamoTable.grantReadWriteData(createOneLambda);
    dynamoTable.grantReadWriteData(updateOneLambda);
    dynamoTable.grantReadWriteData(deleteOneLambda);

    // Tworzymy integracje API Gateway z funkcjami Lambda
    const getAllIntegration = new LambdaIntegration(getAllLambda);
    const createOneIntegration = new LambdaIntegration(createOneLambda);
    const getOneIntegration = new LambdaIntegration(getOneLambda);
    const updateOneIntegration = new LambdaIntegration(updateOneLambda);
    const deleteOneIntegration = new LambdaIntegration(deleteOneLambda);

    // Tworzymy API Gateway REST API
    const api = new RestApi(this, 'itemsApi', {
      restApiName: 'Items Service' // Nazwa API wyświetlana w konsoli AWS
      // W przypadku zarządzania typami binarnymi, odkomentuj poniższą linię
      // binaryMediaTypes: ["*/*"],
    });

    // Dodajemy zasób /items do API
    const items = api.root.addResource('items');
    items.addMethod('GET', getAllIntegration); // GET /items - pobierz wszystkie elementy
    items.addMethod('POST', createOneIntegration); // POST /items - utwórz nowy element
    addCorsOptions(items); // Dodajemy obsługę CORS dla preflight requests

    // Dodajemy zasób /items/{id} do API (parametr ścieżki)
    const singleItem = items.addResource('{id}');
    singleItem.addMethod('GET', getOneIntegration); // GET /items/{id} - pobierz jeden element
    singleItem.addMethod('PATCH', updateOneIntegration); // PATCH /items/{id} - aktualizuj element
    singleItem.addMethod('DELETE', deleteOneIntegration); // DELETE /items/{id} - usuń element
    addCorsOptions(singleItem); // Dodajemy obsługę CORS
  }
}

// Funkcja dodająca obsługę CORS (Cross-Origin Resource Sharing) do zasobu API
export function addCorsOptions(apiResource: IResource) {
  apiResource.addMethod('OPTIONS', new MockIntegration({
    // W przypadku typów binarnych, odkomentuj poniższą linię
    // contentHandling: ContentHandling.CONVERT_TO_TEXT,
    integrationResponses: [{
      statusCode: '200', // Kod odpowiedzi HTTP
      responseParameters: {
        // Nagłówki CORS - określają, które nagłówki są dozwolone w żądaniach
        'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
        // Dozwolone pochodzenia - '*' oznacza wszystkie domeny (tylko dla dev/test)
        'method.response.header.Access-Control-Allow-Origin': "'*'",
        // Czy wysyłać credentials (ciasteczka, autoryzację) - false dla bezpieczeństwa
        'method.response.header.Access-Control-Allow-Credentials': "'false'",
        // Dozwolone metody HTTP
        'method.response.header.Access-Control-Allow-Methods': "'OPTIONS,GET,PUT,POST,DELETE'",
      },
    }],
    // Nie przekazuj żądania dalej - obsłuż lokalnie w API Gateway
    passthroughBehavior: PassthroughBehavior.NEVER,
    requestTemplates: {
      "application/json": "{\"statusCode\": 200}" // Szablon odpowiedzi dla OPTIONS
    },
  }), {
    methodResponses: [{
      statusCode: '200',
      responseParameters: {
        // Definiujemy, które nagłówki odpowiedzi są dostępne
        'method.response.header.Access-Control-Allow-Headers': true,
        'method.response.header.Access-Control-Allow-Methods': true,
        'method.response.header.Access-Control-Allow-Credentials': true,
        'method.response.header.Access-Control-Allow-Origin': true,
      },
    }]
  })
}

// Tworzymy aplikację CDK
const app = new App();
// Tworzymy instancję stacka
new ApiLambdaCrudDynamoDBStack(app, 'ApiLambdaCrudDynamoDBExample');
// Generujemy szablon CloudFormation
app.synth();
