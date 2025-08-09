import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Index,
  UpdateDateColumn,
} from 'typeorm';

const numericTransformer = {
  to: (value?: number) =>
    value !== undefined && value !== null ? value : null,
  from: (value: any) =>
    value !== null && value !== undefined ? Number(value) : null,
};

@Entity()
@Index('uniq_client_name_lower', ['clientId'], { unique: false }) // composite unique via migration
export class Locations {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  // Raw name used for display; uniqueness uses lower(name) via migration
  @Column('decimal', { transformer: numericTransformer })
  latitude: number;

  @Column('decimal', { transformer: numericTransformer })
  longitude: number;

  @Column({ default: true })
  isActive: boolean;

  @Column('uuid')
  @Index()
  clientId: string;

  @UpdateDateColumn()
  updatedAt: Date;
}
