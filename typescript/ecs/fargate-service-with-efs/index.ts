// Importujemy główną bibliotekę AWS CDK
import * as cdk from 'aws-cdk-lib';
// Importujemy moduł EC2 - do zarządzania siecią VPC
import * as ec2 from 'aws-cdk-lib/aws-ec2';
// Importujemy moduł ECS - Elastic Container Service do uruchamiania kontenerów
import * as ecs from 'aws-cdk-lib/aws-ecs';
// Importujemy wzorce ECS - gotowe konfiguracje jak ALB + Fargate
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
// Importujemy moduł EFS - Elastic File System dla współdzielonego przechowywania plików
import * as efs from 'aws-cdk-lib/aws-efs';
// Importujemy moduł IAM - do zarządzania uprawnieniami
import * as iam from 'aws-cdk-lib/aws-iam';

// Stack implementujący usługę Fargate z systemem plików EFS
class FargateEfs extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Tworzymy VPC z maksymalnie 2 strefami dostępności
    const vpc = new ec2.Vpc(this, 'DefaultVpc', { maxAzs: 2});
    // Tworzymy klaster ECS w utworzonym VPC
    const ecsCluster = new ecs.Cluster(this, 'DefaultEcsCluster', {vpc: vpc});

    // Tworzymy system plików EFS do współdzielenia między kontenerami
    const fileSystem = new efs.FileSystem(this, 'MyEfsFileSystem', {
      vpc: vpc, // VPC gdzie będzie dostępny EFS
      encrypted: true, // Szyfrowanie plików w spoczynku
      lifecyclePolicy: efs.LifecyclePolicy.AFTER_14_DAYS, // Przechowywanie rzadko używanych plików po 14 dniach
      performanceMode: efs.PerformanceMode.GENERAL_PURPOSE, // Tryb wydajności: ogólnego przeznaczenia
      throughputMode: efs.ThroughputMode.BURSTING // Tryb przepustowości: z możliwością skoków
    });

    // Dodajemy politykę zasobów do EFS - pozwala na montowanie przez punkty montowania
    fileSystem.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['elasticfilesystem:ClientMount'], // Akcja: montowanie systemu plików
        principals: [new iam.AnyPrincipal()], // Kto może: dowolny principal
        conditions: {
          Bool: {
            'elasticfilesystem:AccessedViaMountTarget': 'true' // Warunek: dostęp przez punkt montowania
          }
        }
      })
    )

    // Tworzymy definicję zadania Fargate
    const taskDef = new ecs.FargateTaskDefinition(this, "MyTaskDefinition", {
        memoryLimitMiB: 512, // Limit pamięci: 512 MB
        cpu: 256, // Jednostki CPU: 256 (0.25 vCPU)
        volumes: [
            {
                name: "uploads", // Nazwa wolumenu do referencji w kontenerze
                efsVolumeConfiguration: {
                    fileSystemId: fileSystem.fileSystemId, // ID systemu plików EFS
                }
            }
        ]
    });

    // Tworzymy definicję kontenera
    const containerDef = new ecs.ContainerDefinition(this, "MyContainerDefinition", {
      image: ecs.ContainerImage.fromRegistry("coderaiser/cloudcmd"), // Obraz Docker z registry
      taskDefinition: taskDef // Przypisujemy do definicji zadania
    });

    // Dodajemy punkt montowania EFS w kontenerze
    containerDef.addMountPoints(
      {
        sourceVolume: "uploads", // Nazwa wolumenu z definicji zadania
        containerPath: "/uploads", // Ścieżka w kontenerze gdzie zostanie zamontowany EFS
        readOnly: false // Pozwalamy na zapis (false = read-write)
      }
    )

    // Dodajemy mapowanie portów - port kontenera będzie dostępny z zewnątrz
    containerDef.addPortMappings({
      containerPort: 8000 // Port wewnętrzny kontenera
    });

    // Tworzymy usługę Fargate z Application Load Balancer używając wzorca
    const albFargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'Service01', {
      cluster: ecsCluster, // Klaster ECS gdzie uruchomić usługę
      taskDefinition: taskDef, // Definicja zadania do uruchomienia
      desiredCount: 2 // Pożądana liczba uruchomionych instancji
    });

    // Konfigurujemy grupę docelową ALB - skracamy czas wyrejestrowania do 30 sekund
    albFargateService.targetGroup.setAttribute('deregistration_delay.timeout_seconds', '30');

    // Pozwalamy zadaniom Fargate na dostęp root do EFS
    fileSystem.grantRootAccess(albFargateService.taskDefinition.taskRole.grantPrincipal);
    // Pozwalamy na połączenia sieciowe między usługą a EFS na domyślnym porcie
    fileSystem.connections.allowDefaultPortFrom(albFargateService.service.connections);
  }
}

// Tworzymy aplikację CDK
const app = new cdk.App();
// Tworzymy stack z Fargate + EFS
new FargateEfs(app, 'FargateEfsDemo01');
// Generujemy szablon CloudFormation
app.synth();
