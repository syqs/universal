import { ValueTransformer } from 'typeorm';
import Decimal from 'decimal.js';

export class ColumnDecimalTransformer implements ValueTransformer {
  /**
   * Used to marshal data when writing to the database.
   */
  to(data: InstanceType<typeof Decimal> | number | string | null | undefined): string | null {
    if (data === null || data === undefined) return null;
    if (data instanceof Decimal) return data.toString();
    if (typeof data === 'number' || typeof data === 'string') return data.toString();
    return null;
  }

  /**
   * Used to unmarshal data when reading from the database.
   */
  from(data: string | number | null | undefined): InstanceType<typeof Decimal> | null {
    if (data === null || data === undefined) return null;
    return new Decimal(data);
  }
}