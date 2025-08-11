// Importujemy główną bibliotekę AWS CDK - zawiera podstawowe klasy do tworzenia stacków
import cdk = require('aws-cdk-lib');
// Importujemy specyficzne klasy CloudFormation dla AWS Amplify - służą do definiowania aplikacji i branchy
import { CfnApp, CfnBranch } from 'aws-cdk-lib/aws-amplify';
// Importujemy bazową klasę Construct - podstawowy element budulcowy w AWS CDK
import { Construct } from 'constructs';

// Definiujemy klasę stacka, która rozszerza cdk.Stack - stack to zbiór zasobów AWS zarządzanych razem
export class AmplifyConsoleAppCdkStack extends cdk.Stack {
  // Konstruktor - inicjalizuje nowy stack z określonymi parametrami
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    // Wywołujemy konstruktor klasy nadrzędnej (cdk.Stack) z przekazanymi parametrami
    super(scope, id, props);

    // Tworzymy aplikację AWS Amplify - hosting dla aplikacji front-endowych
    const amplifyApp = new CfnApp(this, 'test-app', {
      name: 'your-amplify-console-app-name', // Nazwa aplikacji wyświetlana w konsoli AWS Amplify
      repository: 'https://github.com/<the-rest-of-the-repository-url>', // URL repozytorium GitHub z kodem źródłowym
      oauthToken: '<your-gitHub-oauth-token>' // Token OAuth do autoryzacji dostępu do repozytorium GitHub
    });

    // Tworzymy branch w aplikacji Amplify - określa, która gałąź repozytorium będzie automatycznie deployowana
    new CfnBranch(this, 'MasterBranch', {
      appId: amplifyApp.attrAppId, // ID aplikacji Amplify (referencja do utworzonej powyżej aplikacji)
      branchName: 'master' // Nazwa brancha do monitorowania - przy każdej zmianie nastąpi automatyczny deploy
    });
  }
}

// Tworzymy główną aplikację CDK - punkt wejścia dla wszystkich stacków
const app = new cdk.App();
// Tworzymy instancję naszego stacka i dodajemy ją do aplikacji
new AmplifyConsoleAppCdkStack(app, 'AmplifyConsoleApp');
// Generujemy szablon CloudFormation z definicji stacka
app.synth();
