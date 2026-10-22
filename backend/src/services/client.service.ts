import { z } from 'zod'
import { ClientRepository } from '../repositories/client.repository.js'

export const clientInput = z.object({ name: z.string().min(3), phone: z.string().optional(), city: z.string().optional(), document: z.string().optional(), notes: z.string().optional() })
export class ClientService {
  private readonly repository = new ClientRepository()
  list(search?: string) { return this.repository.list(search) }
  create(payload: unknown) { return this.repository.create(clientInput.parse(payload)) }
  update(id: number, payload: unknown) { return this.repository.update(id, clientInput.partial().parse(payload)) }
  delete(id: number) { return this.repository.delete(id) }
}
