import 'server-only';
import { randomBytes, randomInt } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { companies, profiles } from '@/db/schema';
import { supabaseAdmin } from '@/lib/supabase';
import type { UserRole } from '@/lib/domain';

/** Error con mensaje apto para mostrar al usuario final. */
export class CompanyError extends Error {}

/** Slug url-safe a partir del nombre de la empresa, con sufijo aleatorio anti-colisión. */
export function slugify(name: string): string {
    const base = name
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'empresa';
    return `${base}-${randomInt(1000, 9999)}`;
}

/**
 * Crea un usuario de Supabase Auth y su perfil con rol/empresa controlados
 * desde el servidor. Si algo falla después de crear el usuario de auth,
 * se deshace para no dejar cuentas huérfanas.
 */
async function createUserWithProfile(input: {
    email: string;
    password: string;
    name: string;
    role: UserRole;
    companyId: string | null;
}): Promise<string> {
    const admin = supabaseAdmin();
    const { data, error } = await admin.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
        user_metadata: { name: input.name },
    });

    if (error) {
        if (/already|exists|registered/i.test(error.message)) {
            throw new CompanyError(`Ya existe una cuenta con el correo «${input.email}».`);
        }
        throw new CompanyError(`No se pudo crear la cuenta: ${error.message}`);
    }

    const userId = data.user.id;
    try {
        await db.insert(profiles).values({
            id: userId,
            companyId: input.companyId,
            name: input.name,
            role: input.role,
        });
    } catch (error) {
        console.error('[createUserWithProfile] rollback de usuario de auth', error);
        await admin.auth.admin.deleteUser(userId).catch(() => {});
        throw new CompanyError('No se pudo completar el registro. Intenta de nuevo.');
    }

    return userId;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validaciones compartidas de credenciales. */
function validateCredentials(email: string, password: string, name: string): void {
    if (!name || name.length < 2) throw new CompanyError('El nombre es obligatorio.');
    if (!EMAIL.test(email)) throw new CompanyError('El correo no tiene un formato válido.');
    if (password.length < 8) throw new CompanyError('La contraseña debe tener al menos 8 caracteres.');
}

/**
 * Registro self-service de una empresa cliente (público, desde /registro):
 * crea la empresa y su usuario administrador. Devuelve el id de la empresa.
 */
export async function registerCompany(input: {
    companyName: string;
    adminName: string;
    email: string;
    password: string;
}): Promise<void> {
    const companyName = input.companyName.trim().slice(0, 80);
    if (companyName.length < 2) throw new CompanyError('El nombre de la empresa es obligatorio.');
    validateCredentials(input.email.trim(), input.password, input.adminName.trim().slice(0, 80));

    const [company] = await db.insert(companies).values({
        name: companyName,
        slug: slugify(companyName),
        apiKey: randomBytes(32).toString('hex'),
    }).returning({ id: companies.id });

    try {
        await createUserWithProfile({
            email: input.email.trim(),
            password: input.password,
            name: input.adminName.trim().slice(0, 80),
            role: 'admin',
            companyId: company.id,
        });
    } catch (error) {
        // Sin admin la empresa no sirve: se deshace para no acumular registros basura.
        await db.delete(companies).where(eq(companies.id, company.id)).catch(() => {});
        throw error;
    }
}

/** Alta de un chofer por el admin de su empresa. Devuelve el id del usuario. */
export async function createDriver(input: {
    companyId: string;
    name: string;
    email: string;
    password: string;
}): Promise<string> {
    validateCredentials(input.email.trim(), input.password, input.name.trim().slice(0, 80));
    return createUserWithProfile({
        email: input.email.trim(),
        password: input.password,
        name: input.name.trim().slice(0, 80),
        role: 'driver',
        companyId: input.companyId,
    });
}

/** Regenera la api_key de una empresa (la anterior deja de funcionar al instante). */
export async function regenerateApiKey(companyId: string): Promise<string> {
    const key = randomBytes(32).toString('hex');
    await db.update(companies).set({ apiKey: key, updatedAt: new Date() }).where(eq(companies.id, companyId));
    return key;
}
