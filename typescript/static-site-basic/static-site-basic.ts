#!/usr/bin/env node
// Importujemy moduł S3 - służy do przechowywania plików i hostowania stron statycznych
import * as s3 from "aws-cdk-lib/aws-s3";
// Importujemy moduł S3 Deployment - automatyzuje wgrywanie plików do bucket'a S3
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
// Importujemy podstawowe klasy CDK: CfnOutput (outputy), RemovalPolicy (polityka usuwania), Stack
import { CfnOutput, RemovalPolicy, Stack } from "aws-cdk-lib";
// Importujemy bazową klasę Construct
import { Construct } from "constructs";
// Importujemy moduł path do obsługi ścieżek plików
import path = require("path");

// Interfejs definiujący właściwości dla StaticSiteBasic
export interface StaticSiteBasicProps {
  staticContentPrefix: string; // Prefiks ścieżki dla zawartości statycznej w bucket'cie
}

/**
 * Infrastruktura statycznej strony, która wgrywa zawartość strony do bucket'a S3
 */
export class StaticSiteBasic extends Construct {
  // Konstruktor - parent to stack, name to nazwa, props to właściwości
  constructor(parent: Stack, name: string, props: StaticSiteBasicProps) {
    super(parent, name);

    // Definiujemy główny dokument strony (plik startowy)
    const indexDocument = "index.html";

    // Tworzymy bucket S3 do hostowania strony internetowej
    const websiteBucket = new s3.Bucket(this, "WebsiteBucket", {
      websiteIndexDocument: indexDocument, // Określa główny plik HTML
      publicReadAccess: true, // Pozwala na publiczny dostęp do odczytu
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false, // Nie blokuj publicznych ACL
        blockPublicPolicy: false, // Nie blokuj publicznych policy
        ignorePublicAcls: false, // Nie ignoruj publicznych ACL
        restrictPublicBuckets: false, // Nie ograniczaj publicznych bucket'ów
      }),
      /**
       * Domyślna polityka usuwania to RETAIN - bucket pozostanie po 'cdk destroy'
       * DESTROY oznacza, że 'cdk destroy' spróbuje usunąć bucket (ale nie jeśli jest niepusty)
       */
      removalPolicy: RemovalPolicy.DESTROY, // NIE zalecane w kodzie produkcyjnym

      /**
       * Tylko dla celów demonstracyjnych - automatyczne usuwanie obiektów
       * Pozwala na pełne wyczyszczenie demo po zniszczeniu stacka
       */
      autoDeleteObjects: true, // NIE zalecane w kodzie produkcyjnym
    });

    // Output z nazwą bucket'a - wyświetlana po deploymencie
    new CfnOutput(this, "Bucket", { value: websiteBucket.bucketName });
    // Output z URL-em statycznej strony - łączy URL bucket'a z prefiksem i plikiem głównym
    new CfnOutput(this, "StaticSiteUrl", {
      value: [
        websiteBucket.bucketWebsiteUrl, // URL bucket'a do hostowania stron
        props.staticContentPrefix, // Prefiks ścieżki (np. "web/static")
        indexDocument, // Nazwa pliku głównego (index.html)
      ].join("/"), // Łączymy wszystko znakiem "/" tworząc pełny URL
    });

    // Wgrywamy zawartość strony do bucket'a S3
    new s3deploy.BucketDeployment(this, "DeployWebsite", {
      // Źródło plików - lokalny folder z zawartością strony
      sources: [s3deploy.Source.asset(path.join(__dirname, "./site-contents"))],
      destinationBucket: websiteBucket, // Docelowy bucket S3
      destinationKeyPrefix: props.staticContentPrefix, // Opcjonalny prefiks w bucket'cie docelowym
    });
  }
}
