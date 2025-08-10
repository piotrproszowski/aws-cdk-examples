// Importujemy moduł EventBridge (Events) - do zarządzania zdarzeniami i harmonogramami
import events = require('aws-cdk-lib/aws-events');
// Importujemy targets - definiuje cele dla reguł EventBridge
import targets = require('aws-cdk-lib/aws-events-targets');
// Importujemy moduł Lambda - do tworzenia funkcji bezserwerowych  
import lambda = require('aws-cdk-lib/aws-lambda');
// Importujemy główną bibliotekę CDK
import cdk = require('aws-cdk-lib');
// Importujemy moduł systemu plików
import fs = require('fs');
// Importujemy moduł SNS - Simple Notification Service do wysyłania powiadomień
import sns = require('aws-cdk-lib/aws-sns');
// Importujemy subscriptions - różne typy subskrypcji SNS (email, SMS, itp.)
import subscriptions = require('aws-cdk-lib/aws-sns-subscriptions');
// Importujemy moduł IAM - do zarządzania uprawnieniami
import iam = require('aws-cdk-lib/aws-iam');
// Importujemy CfnParameter - parametr CloudFormation podawany podczas deploymentu
import { CfnParameter } from 'aws-cdk-lib';

// Stack implementujący EventBridge uruchamiający Lambda publikującą do SNS
export class EventBridgeLambdaStack extends cdk.Stack {
  constructor(app: cdk.App, id: string) {
    super(app, id);

    // Tworzymy temat SNS do wysyłania powiadomień
    const topic = new sns.Topic(this, 'Topic', {
      displayName: 'Lambda SNS Topic', // Nazwa wyświetlana w konsoli AWS
    });

    // Parametr CloudFormation do wprowadzenia adresu email przez użytkownika
    const emailaddress = new CfnParameter(this, "email", {
      type: "String", // Typ parametru: string
      description: "The name of the Amazon S3 bucket where uploaded files will be stored."});

    // Dodajemy subskrypcję email do tematu SNS
    topic.addSubscription(new subscriptions.EmailSubscription(emailaddress.valueAsString));

    // Tworzymy funkcję Lambda do publikowania wiadomości do SNS
    const lambdaFn = new lambda.Function(this, 'Singleton', {
      // Kod funkcji wczytywany z lokalnego pliku Python
      code: new lambda.InlineCode(fs.readFileSync('lambda-handler.py', { encoding: 'utf-8' })),
      handler: 'index.main', // Punkt wejścia: plik 'index', funkcja 'main'
      timeout: cdk.Duration.seconds(300), // Maksymalny czas wykonania: 5 minut
      runtime: lambda.Runtime.PYTHON_3_9, // Środowisko uruchomieniowe: Python 3.9
      environment: {'TOPIC_ARN': topic.topicArn} // Zmienna środowiskowa z ARN tematu SNS
      
    });

    // Tworzymy regułę EventBridge uruchamianą co minutę
    const rule = new events.Rule(this, 'Rule', {
      // Wyrażenie cron: sekunda(*) minuta(*) godzina(*) dzień_miesiąca(?) miesiąc(*) dzień_tygodnia(*) rok(*)
      schedule: events.Schedule.expression('cron(* * ? * * *)') // Co minutę
    });

    // Dodajemy funkcję Lambda jako cel dla reguły EventBridge
    rule.addTarget(new targets.LambdaFunction(lambdaFn));

    // Tworzymy politykę IAM pozwalającą na publikowanie do SNS
    const snsTopicPolicy = new iam.PolicyStatement({
      actions: ['sns:publish'], // Akcja: publikowanie wiadomości
      resources: ['*'], // Zasoby: wszystkie tematy SNS (można ograniczyć)
    });

    // Dodajemy politykę do roli funkcji Lambda
    lambdaFn.addToRolePolicy(snsTopicPolicy);

  }
}

// Tworzymy aplikację CDK
const app = new cdk.App();
// Tworzymy stack EventBridge + Lambda + SNS
new EventBridgeLambdaStack(app, 'EventBridgeLambdaStack');
// Generujemy szablon CloudFormation
app.synth();
