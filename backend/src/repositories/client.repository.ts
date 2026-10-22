import { prisma } from '../lib/prisma.js'

export class ClientRepository {
  list(search = '') {
    return prisma.client.findMany({ where: { OR: [{ name: { contains: search } }, { phone: { contains: search } }, { city: { contains: search } }] }, include: { vehicles: true }, orderBy: { name: 'asc' } })
  }
  create(data: { name: string; phone?: string; city?: string; document?: string; notes?: string }) { return prisma.client.create({ data }) }
  update(id: number, data: { name?: string; phone?: string; city?: string; document?: string; notes?: string }) { return prisma.client.update({ where: { id }, data }) }
  delete(id: number) { return prisma.client.delete({ where: { id } }) }
}
