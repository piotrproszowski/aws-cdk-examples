// Importujemy moduł EventBridge (Events) - służy do zarządzania harmonogramami i zdarzeniami
import events = require('aws-cdk-lib/aws-events');
// Importujemy targets - definiuje cele dla reguł EventBridge (co ma być wykonane)
import targets = require('aws-cdk-lib/aws-events-targets');
// Importujemy moduł Lambda - do tworzenia funkcji bezserwerowych
import lambda = require('aws-cdk-lib/aws-lambda');
// Importujemy główną bibliotekę CDK
import cdk = require('aws-cdk-lib');

// Importujemy moduł systemu plików do odczytywania kodu Lambda
import fs = require('fs');

// Klasa stacka dla funkcji Lambda uruchamianej przez cron
export class LambdaCronStack extends cdk.Stack {
  // Konstruktor stacka - app to aplikacja CDK, id to unikalny identyfikator
  constructor(app: cdk.App, id: string) {
    super(app, id);

    // Tworzymy funkcję Lambda
    const lambdaFn = new lambda.Function(this, 'Singleton', {
      // Kod funkcji wczytywany z lokalnego pliku Python
      code: new lambda.InlineCode(fs.readFileSync('lambda-handler.py', { encoding: 'utf-8' })),
      handler: 'index.main', // Punkt wejścia: plik 'index', funkcja 'main'
      timeout: cdk.Duration.seconds(300), // Maksymalny czas wykonania: 5 minut
      runtime: lambda.Runtime.PYTHON_3_9, // Środowisko uruchomieniowe: Python 3.9
    });

    // Uruchamianie o 18:00 UTC każdego dnia od poniedziałku do piątku
    // Zobacz: https://docs.aws.amazon.com/lambda/latest/dg/tutorial-scheduled-events-schedule-expressions.html
    const rule = new events.Rule(this, 'Rule', {
      // Wyrażenie cron: minuty(0) godziny(18) dzień_miesiąca(?) miesiąc(*) dzień_tygodnia(MON-FRI) rok(*)
      schedule: events.Schedule.expression('cron(0 18 ? * MON-FRI *)')
    });

    // Dodajemy funkcję Lambda jako cel dla reguły - będzie uruchamiana według harmonogramu
    rule.addTarget(new targets.LambdaFunction(lambdaFn));
  }
}

// Tworzymy aplikację CDK
const app = new cdk.App();
// Tworzymy instancję stacka
new LambdaCronStack(app, 'LambdaCronExample');
// Generujemy szablon CloudFormation
app.synth();
