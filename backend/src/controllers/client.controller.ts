import type { Request, Response, NextFunction } from 'express'
import { ClientService } from '../services/client.service.js'

const service = new ClientService()
export const clientController = {
  list: async (request: Request, response: Response, next: NextFunction) => { try { response.json(await service.list(String(request.query.search ?? ''))) } catch (error) { next(error) } },
  create: async (request: Request, response: Response, next: NextFunction) => { try { response.status(201).json(await service.create(request.body)) } catch (error) { next(error) } },
  update: async (request: Request, response: Response, next: NextFunction) => { try { response.json(await service.update(Number(request.params.id), request.body)) } catch (error) { next(error) } },
  remove: async (request: Request, response: Response, next: NextFunction) => { try { await service.delete(Number(request.params.id)); response.status(204).end() } catch (error) { next(error) } }
}
