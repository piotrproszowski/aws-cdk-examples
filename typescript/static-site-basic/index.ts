#!/usr/bin/env node
// Importujemy wszystkie eksporty z AWS CDK jako namespace 'cdk'
import * as cdk from "aws-cdk-lib";
// Importujemy naszą niestandardową klasę do tworzenia statycznej strony
import { StaticSiteBasic } from "./static-site-basic";

/**
 * Ten stack pozwala użytkownikowi określić ścieżkę prefiksu dla zawartości statycznej
 * w bucket'cie hostującym stronę internetową.
 * Użycie: 'cdk synth -c static-content-prefix=web/static'
 * Lub dodaj do cdk.json:
 * {
 *   "context": {
 *     "static-content-prefix": "web/static",
 *   }
 * }
 **/
// Definiujemy klasę stacka dla statycznej strony internetowej
class MyStaticSiteBasicStack extends cdk.Stack {
  // Konstruktor - parent to aplikacja CDK, name to nazwa stacka, props to właściwości
  constructor(parent: cdk.App, name: string, props: cdk.StackProps) {
    // Wywołujemy konstruktor klasy nadrzędnej
    super(parent, name, props);

    // Tworzymy instancję statycznej strony
    new StaticSiteBasic(this, "StaticSiteBasic", {
      // Pobieramy prefiks ścieżki z kontekstu CDK - pozwala na organizację plików w bucket'cie
      staticContentPrefix: this.node.tryGetContext("static-content-prefix"),
    });
  }
}

// Tworzymy aplikację CDK - główny kontener
const app = new cdk.App();

// Tworzymy instancję naszego stacka
new MyStaticSiteBasicStack(app, "MyStaticSite", {
  env: {
    // Pobieramy ID konta AWS z kontekstu - określa gdzie zostaną utworzone zasoby
    account: app.node.tryGetContext("accountId"),
  },
});

// Generujemy szablon CloudFormation
app.synth();
