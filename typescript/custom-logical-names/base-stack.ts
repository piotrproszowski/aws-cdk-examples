// Importujemy klasy Stack i CfnElement z AWS CDK
import { Stack, CfnElement } from 'aws-cdk-lib';

/**
 * Bazowa klasa stacka implementująca niestandardowe nazwy logiczne
 * Dodaje prefiks jeśli jest zdefiniowany w kluczu kontekstowym "prefix"
 *
 * Użycie: `cdk --context prefix=PREFIX` aby ustawić prefiks
 */
export class BaseStack extends Stack {
  // Metoda odpowiedzialna za alokację logicznego ID dla elementów CloudFormation
  public allocateLogicalId(element: CfnElement) {
    // Pobieramy oryginalny ID z klasy nadrzędnej
    const orig = super.allocateLogicalId(element);
    // Próbujemy pobrać prefiks z kontekstu aplikacji CDK
    const prefix = this.node.tryGetContext('prefix');
    // Zwracamy ID z prefiksem jeśli istnieje, w przeciwnym razie oryginalny ID
    return prefix ? prefix + orig : orig;
  }
}
