import { Logger, Module } from '@nestjs/common';
import { LocalTemplateStorage } from './local-template-storage';
import { SupabaseTemplateStorage } from './supabase-template-storage';
import { TEMPLATE_STORAGE, TemplateStorage } from './template-storage';

type StorageDriver = 'local' | 'supabase';

@Module({
  providers: [
    {
      provide: TEMPLATE_STORAGE,
      useFactory: (): TemplateStorage => {
        const driver: StorageDriver =
          process.env.NODE_ENV === 'production' ? 'supabase' : 'local';
        new Logger('StorageModule').log(`Template storage driver: ${driver}`);
        return driver === 'supabase'
          ? new SupabaseTemplateStorage()
          : new LocalTemplateStorage();
      },
    },
  ],
  exports: [TEMPLATE_STORAGE],
})
export class StorageModule {}
