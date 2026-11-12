import { Module } from '@nestjs/common';
import { FirebaseModule } from '../firebase/firebase.module';
import { ReadReceiptsService } from './read-receipts.service';

@Module({
  imports: [FirebaseModule],
  providers: [ReadReceiptsService],
  exports: [ReadReceiptsService],
})
export class ReadReceiptsModule {}
