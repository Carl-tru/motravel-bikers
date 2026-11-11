import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = document.querySelector('meta[name="supabase-url"]')?.content.trim();
const supabaseAnonKey = document.querySelector('meta[name="supabase-anon-key"]')?.content.trim();
const configMessage = document.getElementById('supabase-config-message');
const authForms = document.getElementById('auth-forms');
const accountPanel = document.getElementById('account-panel');
const censusAccessMessage = document.getElementById('census-access-message');
const censusContent = document.getElementById('census-member-content');
const memberRows = document.getElementById('member-rows');
const adminPanel = document.getElementById('admin-panel');
const adminRows = document.getElementById('admin-rows');
const joinButton = document.getElementById('join-button');

if (!supabaseUrl || !supabaseAnonKey) {
    configMessage.textContent = 'Para activar registros y el censo, configura SUPABASE_URL y SUPABASE_ANON_KEY en el entorno de Spring Boot.';
    configMessage.hidden = false;
    authForms.hidden = true;
} else {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    let currentSession = null;
    let currentProfile = null;
    let currentIsAdmin = false;
    let approvedProfiles = [];
    let realtimeChannel = null;
    let sessionVersion = 0;
    let activeFilter = 'todos';

    function showMessage(element, message, type = 'error') {
        element.textContent = message;
        element.classList.toggle('text-red-700', type === 'error');
        element.classList.toggle('bg-red-50', type === 'error');
        element.classList.toggle('border-red-200', type === 'error');
        element.classList.toggle('text-emerald-800', type === 'success');
        element.classList.toggle('bg-emerald-50', type === 'success');
        element.classList.toggle('border-emerald-200', type === 'success');
        element.hidden = false;
    }

    function clearMessage(element) {
        element.textContent = '';
        element.hidden = true;
    }

    function addOption(select, value, label) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        select.append(option);
    }

    function formatRole(role) {
        return role === 'copilot' ? 'Copiloto' : 'Piloto';
    }

    function formatActivity(status) {
        if (status === 'active') return 'Activo';
        if (status === 'frequent') return 'Frecuente';
        return 'Inactivo';
    }

    function addCell(row, value) {
        const cell = document.createElement('td');
        cell.className = 'py-4 px-4';
        cell.textContent = value || '—';
        row.append(cell);
    }

    function renderCensus() {
        memberRows.replaceChildren();
        const visibleProfiles = approvedProfiles.filter((profile) => {
            if (activeFilter === 'todos') return true;
            if (activeFilter === 'active') return profile.activity_status === 'active';
            return profile.rider_role === activeFilter;
        });

        for (const profile of visibleProfiles) {
            const row = document.createElement('tr');
            row.className = 'hover:bg-slate-50/50 transition';
            addCell(row, profile.full_name);
            addCell(row, formatRole(profile.rider_role));
            addCell(row, profile.motorcycle);
            addCell(row, profile.riding_style);
            addCell(row, formatActivity(profile.activity_status));
            memberRows.append(row);
        }

        if (visibleProfiles.length === 0) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 5;
            cell.className = 'py-8 px-4 text-center text-slate-500';
            cell.textContent = 'No hay integrantes para mostrar en este filtro.';
            row.append(cell);
            memberRows.append(row);
        }
    }

    async function loadCensus() {
        if (!currentProfile || currentProfile.membership_status !== 'approved') return;

        const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name, rider_role, motorcycle, riding_style, activity_status')
            .eq('membership_status', 'approved')
            .order('full_name');

        if (error) throw error;
        approvedProfiles = data;
        renderCensus();
    }

    function renderAdminProfiles(profiles) {
        adminRows.replaceChildren();

        if (profiles.length === 0) {
            const emptyMessage = document.createElement('p');
            emptyMessage.className = 'text-sm text-slate-500';
            emptyMessage.textContent = 'Todavía no hay integrantes registrados.';
            adminRows.append(emptyMessage);
            return;
        }

        for (const profile of profiles) {
            const row = document.createElement('div');
            row.className = 'grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-[minmax(0,1fr)_auto_auto_auto] md:items-center';

            const details = document.createElement('div');
            const name = document.createElement('p');
            name.className = 'font-bold text-navy-900';
            name.textContent = profile.full_name;
            const email = document.createElement('p');
            email.className = 'text-xs text-slate-500';
            email.textContent = profile.email || '';
            const role = document.createElement('p');
            role.className = 'mt-1 text-xs text-slate-600';
            role.textContent = `${formatRole(profile.rider_role)}${profile.motorcycle ? ` · ${profile.motorcycle}` : ''}`;
            details.append(name, email, role);

            const membershipSelect = document.createElement('select');
            membershipSelect.className = 'rounded-lg border border-slate-300 px-3 py-2 text-sm';
            membershipSelect.setAttribute('aria-label', `Acceso al censo para ${profile.full_name}`);
            addOption(membershipSelect, 'pending', 'Pendiente');
            addOption(membershipSelect, 'approved', 'Aprobado');
            addOption(membershipSelect, 'rejected', 'Rechazado');
            membershipSelect.value = profile.membership_status;

            const activitySelect = document.createElement('select');
            activitySelect.className = 'rounded-lg border border-slate-300 px-3 py-2 text-sm';
            activitySelect.setAttribute('aria-label', `Actividad de ${profile.full_name}`);
            addOption(activitySelect, 'active', 'Activo');
            addOption(activitySelect, 'frequent', 'Frecuente');
            addOption(activitySelect, 'inactive', 'Inactivo');
            activitySelect.value = profile.activity_status;

            const saveButton = document.createElement('button');
            saveButton.type = 'button';
            saveButton.className = 'rounded-lg bg-gold-500 px-4 py-2 text-sm font-bold text-navy-950 hover:bg-gold-400';
            saveButton.textContent = 'Guardar';
            saveButton.addEventListener('click', async () => {
                saveButton.disabled = true;
                try {
                    const { error } = await supabase
                        .from('profiles')
                        .update({
                            membership_status: membershipSelect.value,
                            activity_status: activitySelect.value
                        })
                        .eq('id', profile.id);
                    if (error) throw error;
                    await refreshData();
                } catch (error) {
                    showMessage(document.getElementById('account-message'), error.message);
                } finally {
                    saveButton.disabled = false;
                }
            });

            row.append(details, membershipSelect, activitySelect, saveButton);
            adminRows.append(row);
        }
    }

    async function loadAdminProfiles() {
        if (!currentIsAdmin) return;
        const { data, error } = await supabase.rpc('list_profiles_for_admin');
        if (error) throw error;
        renderAdminProfiles(data);
    }

    function renderProfile(profile) {
        document.getElementById('profile-name').textContent = profile.full_name;
        document.getElementById('profile-email').textContent = currentSession.user.email || '';
        document.getElementById('profile-status').textContent =
            profile.membership_status === 'approved'
                ? `Integrante aprobado · Actividad: ${formatActivity(profile.activity_status)}`
                : profile.membership_status === 'rejected'
                    ? 'La solicitud de ingreso no fue aprobada. Contacta a un administrador.'
                    : 'Tu solicitud está pendiente de aprobación. Podrás consultar el censo cuando un administrador la apruebe.';

        document.getElementById('census-access-copy').textContent =
            profile.membership_status === 'rejected'
                ? 'Tu solicitud de ingreso no fue aprobada. Contacta a un administrador si necesitas más información.'
                : 'Tu cuenta todavía no tiene acceso al censo. Un administrador debe aprobar tu solicitud.';
        document.getElementById('census-access-link').hidden = true;

        const form = document.getElementById('profile-form');
        form.elements.full_name.value = profile.full_name;
        form.elements.rider_role.value = profile.rider_role;
        form.elements.motorcycle.value = profile.motorcycle || '';
        form.elements.riding_style.value = profile.riding_style || '';

        const isApproved = profile.membership_status === 'approved';
        censusAccessMessage.hidden = isApproved;
        censusContent.hidden = !isApproved;
        adminPanel.hidden = !currentIsAdmin;
    }

    async function refreshData() {
        if (!currentSession) return;
        const version = sessionVersion;
        const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name, rider_role, motorcycle, riding_style, membership_status, activity_status')
            .eq('id', currentSession.user.id)
            .maybeSingle();

        if (version !== sessionVersion) return;
        if (error) throw error;
        if (!data) throw new Error('No encontramos el perfil. Contacta al administrador del club.');

        const { data: isAdmin, error: adminError } = await supabase.rpc('is_club_admin');
        if (adminError) throw adminError;
        currentIsAdmin = isAdmin === true;
        currentProfile = data;
        renderProfile(data);
        clearMessage(document.getElementById('account-message'));

        if (data.membership_status === 'approved') {
            await loadCensus();
        } else {
            approvedProfiles = [];
            memberRows.replaceChildren();
        }
        await loadAdminProfiles();
    }

    async function setSession(session) {
        sessionVersion += 1;
        currentSession = session;
        currentProfile = null;
        currentIsAdmin = false;

        authForms.hidden = Boolean(session);
        accountPanel.hidden = !session;
        if (joinButton) joinButton.textContent = session ? 'Mi cuenta' : 'Unirme al Club';

        if (realtimeChannel) {
            await supabase.removeChannel(realtimeChannel);
            realtimeChannel = null;
        }

        if (!session) {
            censusAccessMessage.hidden = false;
            document.getElementById('census-access-copy').textContent =
                'Inicia sesión con una cuenta aprobada para consultar pilotos, copilotos y estado de actividad.';
            document.getElementById('census-access-link').hidden = false;
            censusContent.hidden = true;
            adminPanel.hidden = true;
            approvedProfiles = [];
            memberRows.replaceChildren();
            return;
        }

        try {
            await refreshData();
            const userId = session.user.id;
            realtimeChannel = supabase
                .channel(`profiles-${userId}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
                    window.setTimeout(() => {
                        refreshData().catch((error) => showMessage(document.getElementById('account-message'), error.message));
                    }, 0);
                })
                .subscribe((status) => {
                    const statusMessage = document.getElementById('realtime-status');
                    if (status === 'SUBSCRIBED') {
                        statusMessage.textContent = 'Censo sincronizado en tiempo real.';
                        statusMessage.hidden = false;
                    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                        statusMessage.textContent = 'No se pudo conectar a tiempo real. Recarga la página para ver cambios recientes.';
                        statusMessage.hidden = false;
                    }
                });
        } catch (error) {
            showMessage(document.getElementById('account-message'), error.message);
        }
    }

    document.getElementById('sign-up-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const submitButton = form.querySelector('button[type="submit"]');
        const message = document.getElementById('sign-up-message');
        clearMessage(message);
        submitButton.disabled = true;

        try {
            const values = Object.fromEntries(new FormData(form));
            const { data, error } = await supabase.auth.signUp({
                email: values.email,
                password: values.password,
                options: {
                    data: {
                        full_name: values.full_name,
                        rider_role: values.rider_role,
                        motorcycle: values.motorcycle,
                        riding_style: values.riding_style
                    },
                    emailRedirectTo: `${window.location.origin}${window.location.pathname}`
                }
            });
            if (error) throw error;
            form.reset();

            if (data.session) {
                await setSession(data.session);
            } else {
                showMessage(message, 'Registro recibido. Revisa tu correo para confirmar la cuenta; después un administrador aprobará tu ingreso al censo.', 'success');
            }
        } catch (error) {
            showMessage(message, error.message);
        } finally {
            submitButton.disabled = false;
        }
    });

    document.getElementById('sign-in-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const submitButton = form.querySelector('button[type="submit"]');
        const message = document.getElementById('sign-in-message');
        clearMessage(message);
        submitButton.disabled = true;

        try {
            const values = Object.fromEntries(new FormData(form));
            const { error } = await supabase.auth.signInWithPassword({
                email: values.email,
                password: values.password
            });
            if (error) throw error;
            form.reset();
        } catch (error) {
            showMessage(message, error.message);
        } finally {
            submitButton.disabled = false;
        }
    });

    document.getElementById('profile-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;

        try {
            const values = Object.fromEntries(new FormData(form));
            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: values.full_name,
                    rider_role: values.rider_role,
                    motorcycle: values.motorcycle || null,
                    riding_style: values.riding_style || null
                })
                .eq('id', currentSession.user.id);
            if (error) throw error;
            await refreshData();
            showMessage(document.getElementById('account-message'), 'Perfil actualizado.', 'success');
        } catch (error) {
            showMessage(document.getElementById('account-message'), error.message);
        } finally {
            submitButton.disabled = false;
        }
    });

    document.getElementById('sign-out-button').addEventListener('click', async () => {
        const { error } = await supabase.auth.signOut();
        if (error) showMessage(document.getElementById('account-message'), error.message);
    });

    document.querySelectorAll('[data-census-filter]').forEach((button) => {
        button.addEventListener('click', () => {
            activeFilter = button.dataset.censusFilter;
            document.querySelectorAll('[data-census-filter]').forEach((filterButton) => {
                filterButton.classList.toggle('bg-gold-500', filterButton === button);
                filterButton.classList.toggle('text-white', filterButton === button);
                filterButton.classList.toggle('bg-slate-100', filterButton !== button);
                filterButton.classList.toggle('text-slate-600', filterButton !== button);
            });
            renderCensus();
        });
    });

    supabase.auth.onAuthStateChange((_event, session) => {
        window.setTimeout(() => setSession(session), 0);
    });
    supabase.auth.getSession().then(({ data, error }) => {
        if (error) {
            showMessage(document.getElementById('sign-in-message'), error.message);
            return;
        }
        setSession(data.session);
    });
}
