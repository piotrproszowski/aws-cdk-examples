// Importujemy główną bibliotekę AWS CDK
import * as cdk from 'aws-cdk-lib';
// Importujemy moduł EC2 - do tworzenia sieci VPC, podsieci, opcji DHCP
import * as ec2 from 'aws-cdk-lib/aws-ec2';
// Importujemy moduł Directory Service - do zarządzania Active Directory
import * as ad from 'aws-cdk-lib/aws-directoryservice';
// Importujemy moduł FSx - do tworzenia systemów plików w chmurze
import * as fsx from 'aws-cdk-lib/aws-fsx';
// Importujemy moduł Secrets Manager - do bezpiecznego przechowywania haseł
import * as sm from 'aws-cdk-lib/aws-secretsmanager';

// Stack konfigurujący Active Directory z systemem plików FSx
class AdFsxStack extends cdk.Stack {
  // Konstruktor - adDnsDomainName to nazwa domeny AD (np. "example.corp")
  constructor(app: cdk.App, id: string, adDnsDomainName: string) {
    super(app, id);

    // Tworzymy VPC z domyślną konfiguracją (publiczne i prywatne podsieci)
    const vpc = new ec2.Vpc(this, 'VPC', {});

    // Wybieramy pierwsze 2 prywatne podsieci dla Active Directory (wymaga co najmniej 2)
    const privateSubnets = vpc.privateSubnets.slice(0,2).map(x => x.subnetId)

    // Tworzymy sekret z automatycznie generowanym hasłem dla administratora AD
    const templatedSecret = new sm.Secret(this, adDnsDomainName + '_credentials', {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'admin' }), // Nazwa użytkownika jako szablon
        generateStringKey: 'password' // Klucz dla automatycznie generowanego hasła
      },
    });

    // Tworzymy zarządzany Microsoft Active Directory
    const mad = new ad.CfnMicrosoftAD(this, 'ad', {
      name: adDnsDomainName, // Nazwa domeny AD (FQDN)
      password: templatedSecret.secretValueFromJson('password').toString(), // Hasło administratora z sekretu
      vpcSettings: {
        vpcId: vpc.vpcId, // ID VPC gdzie zostanie utworzony AD
        subnetIds: privateSubnets // ID podsieci (muszą być w różnych strefach dostępności)
      }
    })

    // Tworzymy opcje DHCP dla VPC - konfigurują klientów do używania AD jako DNS
    const dhcpOptions = new ec2.CfnDHCPOptions(this, 'dhcpOptions', {
      domainName: adDnsDomainName, // Domena która będzie automatycznie dopisywana do nazw hostów
      domainNameServers: mad.attrDnsIpAddresses, // Adresy IP serwerów DNS Active Directory
    })

    // Przypisujemy opcje DHCP do VPC
    new ec2.CfnVPCDHCPOptionsAssociation(this, 'dhcpOptionsAssoc', {
      dhcpOptionsId: dhcpOptions.ref, // Referencja do utworzonych opcji DHCP
      vpcId: vpc.vpcId // ID VPC do którego przypisujemy opcje
    })
    
    // Tworzymy system plików FSx dla Windows zintegrowany z Active Directory
    const fs = new fsx.CfnFileSystem(this, 'fs', {
      fileSystemType: 'WINDOWS', // Typ systemu plików - Windows File Server
      subnetIds: privateSubnets, // Podsieci gdzie będzie dostępny system plików
      storageType: 'SSD', // Typ dysku - SSD dla lepszej wydajności
      storageCapacity: 32, // Pojemność w GB (minimum dla SSD to 32 GB)
      windowsConfiguration: {
        activeDirectoryId: mad.ref, // ID Active Directory do integracji
        throughputCapacity: 8, // Przepustowość w MB/s
        deploymentType: 'MULTI_AZ_1', // Wdrożenie w wielu strefach dostępności dla HA
        preferredSubnetId: privateSubnets[0] // Preferowana podsieć dla głównego punktu dostępu
      }
    })
    
    // Definicjamy outputy zawierające informacje o utworzonych zasobach
    const outputs = [
      {"name":"directoryAlias","value":mad.attrAlias}, // Alias Active Directory
      {"name":"directoryDns","value":cdk.Fn.join(',',mad.attrDnsIpAddresses)}, // Adresy IP DNS AD
      {"name":"fsType", "value": fs.fileSystemType}, // Typ systemu plików
      {"name":"subnetIds", "value": cdk.Fn.join(',',privateSubnets)}, // ID podsieci
      {"name":"vpcId", "value":vpc.vpcId} // ID VPC
    ]
    
    // Tworzymy outputy CloudFormation dla każdego elementu z tablicy
    outputs.forEach((x) => { 
      if (x.value) {
        new cdk.CfnOutput(this, x.name, {value: x.value}) // Output wyświetlany po deploymencie
      }
    })
  }
}

// Tworzymy aplikację CDK
const app = new cdk.App();
// Tworzymy stack z domeną "example.corp"
new AdFsxStack(app, 'AdFsxStack', 'example.corp');
// Generujemy szablon CloudFormation
app.synth();
