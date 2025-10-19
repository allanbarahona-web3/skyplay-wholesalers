// src/modules/me/me.module.ts
import { Module } from '@nestjs/common';
import { MeController } from './me.controller';

@Module({ controllers: [MeController] })
export class MeModule {}
