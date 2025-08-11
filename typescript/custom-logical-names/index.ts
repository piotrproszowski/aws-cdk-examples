#!/usr/bin/env node
// Importujemy bazową klasę stacka z innego pliku - przykład dziedziczenia w CDK
import { BaseStack } from './base-stack';
// Importujemy główne klasy CDK - App to aplikacja, StackProps to opcjonalne właściwości stacka
import { App, StackProps } from 'aws-cdk-lib';
// Importujemy moduły AWS S3 - służy do przechowywania plików w chmurze
import s3 = require('aws-cdk-lib/aws-s3');
// Importujemy moduł AWS SNS - służy do wysyłania powiadomień (Simple Notification Service)
import sns = require('aws-cdk-lib/aws-sns');
// Importujemy bazową klasę Construct
import { Construct } from 'constructs';

// Definiujemy nasz stack, który rozszerza BaseStack (zamiast bezpośrednio cdk.Stack)
class MyStack extends BaseStack {
  // Konstruktor stacka - przyjmuje scope (rodzica), id (unikalny identyfikator) i opcjonalne właściwości
  constructor(scope: Construct, id: string, props?: StackProps) {
    // Wywołujemy konstruktor klasy nadrzędnej
    super(scope, id, props);

    // Tworzymy temat SNS - służy do publikowania wiadomości dla subskrybentów
    new sns.Topic(this, 'MyTopic');
    // Tworzymy bucket S3 - pojemnik na pliki w chmurze AWS
    new s3.Bucket(this, 'MyBucket');
  }
}

// Tworzymy aplikację CDK - główny kontener dla wszystkich stacków
const app = new App();
// Tworzymy instancję naszego stacka i dodajemy do aplikacji
new MyStack(app, 'MyStack');
// Syntetyzujemy (generujemy) szablon CloudFormation na podstawie naszej definicji
app.synth();
