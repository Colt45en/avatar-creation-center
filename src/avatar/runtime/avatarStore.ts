import { AvatarCache } from './avatarCache';
import { ProcessedAvatar } from '../contracts/avatarTypes';

export class AvatarRuntimeStore {
  private static cache = new AvatarCache();
  
  static async saveAvatar(avatar: ProcessedAvatar): Promise<void> {
    await this.cache.save(avatar);
  }
  
  static async getHistory(): Promise<ProcessedAvatar[]> {
    return await this.cache.getAll();
  }
  
  static async deleteAvatar(id: string): Promise<void> {
    await this.cache.delete(id);
  }
}
