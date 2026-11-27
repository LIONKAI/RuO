import { boolean, date, doublePrecision, index, integer, jsonb, numeric, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

export const companies = pgTable('companies', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    active: boolean('active').notNull().default(true),
    apiKey: text('api_key').notNull().unique(),
    plan: text('plan', { enum: ['piloto', 'pro', 'enterprise'] }).notNull().default('piloto'),
    maxVehicles: integer('max_vehicles').notNull().default(5),
    monthlyPrice: numeric('monthly_price', { precision: 8, scale: 2 }).notNull().default('300'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const profiles = pgTable('profiles', {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    role: text('role', { enum: ['superadmin', 'admin', 'driver'] }).notNull().default('driver'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const vehicles = pgTable('vehicles', {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    driverId: uuid('driver_id').unique().references(() => profiles.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    plate: text('plate').notNull().unique(),
    fuelLitersPerKm: numeric('fuel_liters_per_km', { precision: 6, scale: 3 }).notNull().default('0.10'),
    depotAddress: text('depot_address'),
    depotLatitude: doublePrecision('depot_latitude'),
    depotLongitude: doublePrecision('depot_longitude'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const workdays = pgTable(
    'workdays',
    {
        id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
        companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
        vehicleId: integer('vehicle_id').notNull().references(() => vehicles.id, { onDelete: 'cascade' }),
        date: date('date').notNull(),
        status: text('status', { enum: ['draft', 'in_progress', 'completed'] }).notNull().default('draft'),
        routeVersion: integer('route_version').notNull().default(0),
        routeUpdatedAt: timestamp('route_updated_at', { withTimezone: true }),
        totalKm: numeric('total_km', { precision: 8, scale: 2 }),
        estimatedFuelLiters: numeric('estimated_fuel_liters', { precision: 8, scale: 2 }),
        lastLatitude: doublePrecision('last_latitude'),
        lastLongitude: doublePrecision('last_longitude'),
        lastPositionAt: timestamp('last_position_at', { withTimezone: true }),
        completedAt: timestamp('completed_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [unique().on(t.vehicleId, t.date)],
);

export const destinations = pgTable(
    'destinations',
    {
        id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
        companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
        workdayId: integer('workday_id').references(() => workdays.id, { onDelete: 'cascade' }),
        address: text('address').notNull(),
        reference: text('reference').notNull(),
        phone: text('phone'),
        latitude: doublePrecision('latitude').notNull(),
        longitude: doublePrecision('longitude').notNull(),
        status: text('status', { enum: ['pending', 'completed', 'failed'] }).notNull().default('pending'),
        isUnplanned: boolean('is_unplanned').notNull().default(false),
        position: integer('position'),
        legDistanceMeters: integer('leg_distance_meters'),
        legDurationSeconds: integer('leg_duration_seconds'),
        legGeometry: jsonb('leg_geometry'),
        legSteps: jsonb('leg_steps'),
        completedAt: timestamp('completed_at', { withTimezone: true }),
        failureReason: text('failure_reason'),
        failedAt: timestamp('failed_at', { withTimezone: true }),
        serviceDate: date('service_date').notNull(),
        publicToken: uuid('public_token').notNull().unique().defaultRandom(),
        recipientName: text('recipient_name'),
        podNote: text('pod_note'),
        podPhotoPath: text('pod_photo_path'),
        podSignaturePath: text('pod_signature_path'),
        deliveredLatitude: doublePrecision('delivered_latitude'),
        deliveredLongitude: doublePrecision('delivered_longitude'),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [
        index('destinations_workday_position_idx').on(t.workdayId, t.position),
        index('destinations_service_date_idx').on(t.serviceDate, t.workdayId),
    ],
);


export const pushSubscriptions = pgTable('push_subscriptions', {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    profileId: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull().unique(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Company = typeof companies.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type Vehicle = typeof vehicles.$inferSelect;
export type Workday = typeof workdays.$inferSelect;
export type Destination = typeof destinations.$inferSelect;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
