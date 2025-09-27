import { type SchemaTypeDefinition } from 'sanity'
import order from './order'
import { Products } from './prodduct'

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [order,Products],
}
