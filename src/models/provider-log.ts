import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class ProviderLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 7 })
  vrm: string;

  @Column()
  requestDate: Date;

  @Column()
  requestDuration: number;

  @Column()
  requestUrl: string;

  @Column()
  providerName: string;

  @Column({ nullable: true })
  responseCode: number;

  @Column({ nullable: true })
  errorMessage: string;
}
