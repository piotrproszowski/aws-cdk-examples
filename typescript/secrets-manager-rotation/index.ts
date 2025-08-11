// Importujemy moduł Python Lambda dla funkcji Lambda w Pythonie
import * as pyLambda from '@aws-cdk/aws-lambda-python-alpha';
// Importujemy wiele modułów AWS CDK - App, EC2, ElastiCache, IAM, Lambda, Secrets Manager, itp.
import {
    App, aws_ec2 as ec2, aws_elasticache as elasticache, aws_iam as iam, aws_lambda as lambda,
    aws_secretsmanager as secretsmanager, Duration, Stack, StackProps, Tags
} from 'aws-cdk-lib';

// Importujemy moduł path do obsługi ścieżek plików
import path = require("path");

// Stack implementujący automatyczną rotację sekretów dla Redis ElastiCache
export class SecretsManagerCustomRotationStack extends Stack {
  constructor(scope: App, id: string, props?: StackProps) {
    super(scope, id, props);

    // ID klastra Redis - używane w konfiguracji
    const clusterId = "redis-demo-cluster";

    // Tworzymy VPC z tylko prywatnymi podsieciami (izolowane od internetu)
    const vpc = new ec2.Vpc(this, "Vpc", {
      subnetConfiguration: [
        {
          cidrMask: 24, // Maska sieci /24 (256 adresów IP)
          name: "Private", // Nazwa podsieci
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED, // Typ: prywatna izolowana (bez NAT Gateway)
        }
      ]
    });

    // Pobieramy ID wszystkich izolowanych podsieci
    const privateSubnets = vpc.isolatedSubnets.map((subnet) => subnet.subnetId);

    // Grupa bezpieczeństwa dla klastra ElastiCache Redis
    const ecSecurityGroup = new ec2.SecurityGroup(this, "ElastiCacheSG", {
      vpc: vpc,
      description:
        "SecurityGroup associated with the ElastiCache Redis Cluster",
    });

    // Pozwalamy na ruch przychodzący na port Redis (6379) z dowolnego IP
    ecSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(), // Źródło: dowolny adres IPv4
      ec2.Port.tcp(6379), // Port: 6379 (standardowy port Redis)
      "Redis ingress 6379" // Opis reguły
    );

    // Grupa bezpieczeństwa dla funkcji Lambda rotującej sekrety
    const rotatorSecurityGroup = new ec2.SecurityGroup(this, "RotatorSG", {
      vpc: vpc,
      description: "SecurityGroup for rotator function",
    });

    // Pozwalamy na cały ruch przychodzący (potrzebne dla komunikacji VPC Endpoint)
    rotatorSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.allTraffic(),
      "All port inbound"
    );

    // VPC Endpoint dla ElastiCache - umożliwia dostęp do API ElastiCache z prywatnych podsieci
    const elasticacheVpcEndpoint = new ec2.InterfaceVpcEndpoint(this, 'ElastiCache VPC Endpoint', {
      vpc,
      service: new ec2.InterfaceVpcEndpointService('com.amazonaws.'+Stack.of(this).region+'.elasticache', 443),
      privateDnsEnabled: true, // Włącz prywatny DNS
      open: true, // Otwórz dla wszystkich w VPC
      subnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED, // Umieść w izolowanych podsieciach
      },
      securityGroups:[rotatorSecurityGroup] // Przypisz grupę bezpieczeństwa
    });

    // VPC Endpoint dla Secrets Manager - umożliwia dostęp do API Secrets Manager
    const secretsManagerVpcEndpoint = vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER
    });

    // Dodajemy tag 'Name' do VPC Endpoint ElastiCache
    Tags.of(elasticacheVpcEndpoint).add('Name', 'elasticache')
    
    // Grupa podsieci dla ElastiCache - określa gdzie mogą być umieszczone węzły
    const ecSubnetGroup = new elasticache.CfnSubnetGroup(
      this,
      "ElastiCacheSubnetGroup",
      {
        description: "Elasticache Subnet Group",
        subnetIds: privateSubnets, // Lista ID podsieci
      }
    );

    // Tworzymy sekret z automatycznie generowanym tokenem autoryzacji dla Redis
    const secret = new secretsmanager.Secret(this, "RedisAuth", {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ replicationGroupId: clusterId }), // Szablon z ID grupy replikacji
        generateStringKey: "authToken", // Klucz dla generowanego hasła
        excludeCharacters: "@%*()_+=`~{}|[]\\:\";'?,./", // Znaki wykluczzone z hasła
      },
    });

    // Tworzymy grupę replikacji Redis (klaster z replikami)
    const ecClusterReplicationGroup = new elasticache.CfnReplicationGroup(
      this,
      "RedisReplicationGroup",
      {
        replicationGroupDescription: "RedisReplicationGroup-RBAC-Demo",
        replicationGroupId: clusterId, // Unikalny ID grupy
        atRestEncryptionEnabled: true, // Szyfrowanie w spoczynku
        multiAzEnabled: true, // Rozmieszczenie w wielu strefach dostępności
        cacheNodeType: "cache.m4.large", // Typ instancji węzłów cache
        cacheSubnetGroupName: ecSubnetGroup.ref, // Grupa podsieci
        engine: "Redis", // Silnik cache
        engineVersion: "6.x", // Wersja Redis
        numNodeGroups: 1, // Liczba grup węzłów (shardów)
        replicasPerNodeGroup: 1, // Liczba replik na grupę węzłów
        securityGroupIds: [ecSecurityGroup.securityGroupId], // Grupy bezpieczeństwa
        transitEncryptionEnabled: true, // Szyfrowanie w tranzycie
        authToken: secret.secretValueFromJson("authToken").toString(), // Token auth z sekretu
      }
    );

    // Rola IAM dla funkcji Lambda rotującej sekrety
    const rotatorRole = new iam.Role(this, "rotatorRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"), // Może być używana przez Lambda
      description: "Role to be assumed by producer  lambda",
    });

    // Dodajemy zarządzane policy dla podstawowego wykonania Lambda
    rotatorRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        "service-role/AWSLambdaBasicExecutionRole" // Podstawowe logi CloudWatch
      )
    );
    // Dodajemy policy dla dostępu do VPC
    rotatorRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        "service-role/AWSLambdaVPCAccessExecutionRole" // Dostęp do VPC dla Lambda
      )
    );
    // Dodajemy uprawnienia do zarządzania sekretami
    rotatorRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        resources: [secret.secretArn], // ARN naszego sekretu
        actions: [
          "secretsmanager:DescribeSecret", // Opis sekretu
          "secretsmanager:GetSecretValue", // Pobieranie wartości
          "secretsmanager:PutSecretValue", // Zapisywanie nowej wartości
          "secretsmanager:UpdateSecretVersionStage", // Aktualizacja etapu wersji
        ],
      })
    );

    // Dodajemy uprawnienia do zarządzania grupą replikacji ElastiCache
    rotatorRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        resources: [
          "arn:aws:elasticache:" +
            Stack.of(this).region +
            ":" +
            Stack.of(this).account +
            ":replicationgroup:" +
            ecClusterReplicationGroup.replicationGroupId, // ARN grupy replikacji
        ],
        actions: [
          "elasticache:ModifyReplicationGroup", // Modyfikacja grupy (zmiana hasła)
          "elasticache:DescribeReplicationGroups", // Opis grupy (sprawdzanie stanu)
        ],
      })
    );

    // Dodajemy uprawnienia do generowania losowych haseł
    rotatorRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        resources: ["*"], // Wszystkie zasoby
        actions: ["secretsmanager:GetRandomPassword"], // Generowanie losowego hasła
      })
    );

    // Tworzymy warstwę Lambda z biblioteką redis-py
    const redisPyLayer = new pyLambda.PythonLayerVersion(this, "RedisPyLayer", {
      entry: path.join(__dirname, "lambda", "layer", "redis-py"), // Ścieżka do kodu warstwy
      compatibleRuntimes: [
        lambda.Runtime.PYTHON_3_9,
        lambda.Runtime.PYTHON_3_8,
        lambda.Runtime.PYTHON_3_7,
        lambda.Runtime.PYTHON_3_6,
      ], // Zgodne środowiska uruchomieniowe
      description: "A layer that contains the redis-py module",
      license: "MIT License",
    });

    // Tworzymy funkcję Lambda do rotacji sekretów
    const fn = new pyLambda.PythonFunction(this, "SecretRotationFunction", {
      runtime: lambda.Runtime.PYTHON_3_9, // Środowisko Python 3.9
      entry: path.join(__dirname, "lambda"), // Ścieżka do kodu funkcji
      handler: "lambda_handler", // Nazwa funkcji obsługującej
      index: "index.py", // Główny plik
      layers: [redisPyLayer], // Warstwy z zależnościami
      role: rotatorRole, // Rola IAM
      timeout: Duration.seconds(30), // Timeout 30 sekund
      vpc: vpc, // VPC gdzie uruchomić funkcję
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED }, // Podsieci
      securityGroups: [ecSecurityGroup, rotatorSecurityGroup], // Grupy bezpieczeństwa
      environment: {
        replicationGroupId: ecClusterReplicationGroup.ref, // ID grupy replikacji
        redis_endpoint: ecClusterReplicationGroup.attrPrimaryEndPointAddress, // Endpoint Redis
        redis_port: ecClusterReplicationGroup.attrPrimaryEndPointPort, // Port Redis
        EXCLUDE_CHARACTERS: "@%*()_+=`~{}|[]\\:\";'?,./", // Znaki wykluczane z hasła
        SECRETS_MANAGER_ENDPOINT:
          "https://secretsmanager." + Stack.of(this).region + ".amazonaws.com", // Endpoint Secrets Manager
      },
    });

    // Dodajemy harmonogram rotacji co 15 dni
    secret.addRotationSchedule("RotationSchedule", {
      rotationLambda: fn, // Funkcja Lambda do rotacji
      automaticallyAfter: Duration.days(15), // Rotacja co 15 dni
    });

    // Przyznajemy funkcji Lambda uprawnienia do odczytu sekretu
    secret.grantRead(fn);

    // Pozwalamy Secrets Manager na wywoływanie naszej funkcji Lambda
    fn.grantInvoke(new iam.ServicePrincipal("secretsmanager.amazonaws.com"));

    // Dodajemy policy do VPC Endpoint Secrets Manager - generowanie haseł
    secretsManagerVpcEndpoint.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        resources: ["*"],
        actions: ["secretsmanager:GetRandomPassword"],
        principals: [rotatorRole] // Tylko nasza rola może używać
      })
    )

    // Dodajemy policy do VPC Endpoint Secrets Manager - zarządzanie sekretami
    secretsManagerVpcEndpoint.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        resources: [secret.secretArn],
        actions: [
          "secretsmanager:DescribeSecret",
          "secretsmanager:GetSecretValue",
          "secretsmanager:PutSecretValue",
          "secretsmanager:UpdateSecretVersionStage",
        ],
        principals: [rotatorRole]
      })
    )

    // Dodajemy policy do VPC Endpoint ElastiCache - zarządzanie grupą replikacji
    elasticacheVpcEndpoint.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        resources: [
          "arn:aws:elasticache:" +
            Stack.of(this).region +
            ":" +
            Stack.of(this).account +
            ":replicationgroup:" +
            ecClusterReplicationGroup.replicationGroupId,
        ],
        actions: [
          "elasticache:ModifyReplicationGroup",
          "elasticache:DescribeReplicationGroups",
        ],
        principals: [rotatorRole]
      })
    )

  }
}

// Tworzymy aplikację CDK
const app = new App();
// Tworzymy stack z automatyczną rotacją sekretów
new SecretsManagerCustomRotationStack(app, "SecretsManagerCustomRotationStack");
// Generujemy szablon CloudFormation
app.synth();
