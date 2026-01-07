// Spanish translations
export const es = {
    // Common
    common: {
        save: 'Guardar',
        cancel: 'Cancelar',
        delete: 'Eliminar',
        edit: 'Editar',
        add: 'Añadir',
        done: 'Hecho',
        close: 'Cerrar',
        yes: 'Sí',
        no: 'No',
        ok: 'OK',
        loading: 'Cargando...',
        error: 'Error',
        success: 'Éxito',
        today: 'hoy',
        yesterday: 'Ayer',
        days: 'días',
        week: 'Semana',
        month: 'Mes',
        year: 'Año',
    },

    // Navigation
    nav: {
        home: 'Inicio',
        addHabit: 'Nuevo Hábito',
        editHabit: 'Editar Hábito',
        stats: 'Estadísticas',
        settings: 'Ajustes',
        share: 'Compartir',
        habitDetail: 'Detalles del Hábito',
    },

    // Home Screen
    home: {
        noHabitsYet: 'Sin hábitos aún',
        startBuilding: '¡Empieza a construir mejores hábitos hoy!',
        addFirstHabit: 'Añade Tu Primer Hábito',
    },

    // Habit Card
    habitCard: {
        todayProgress: '{{progress}}/{{target}} hoy',
    },

    // Add/Edit Habit
    habit: {
        name: 'Nombre del Hábito',
        namePlaceholder: 'ej., Ejercicio matutino',
        description: 'Descripción (Opcional)',
        descriptionPlaceholder: 'ej., Despejar la mente y mantenerse enfocado',
        icon: 'Icono',
        color: 'Color',
        dailyTarget: 'Meta Diaria',
        goal: 'Objetivo',
        goalPlaceholder: 'ej., Estar más saludable',
        frequency: 'Frecuencia',
        daily: 'Diario',
        weekly: 'Semanal',
        createHabit: 'Crear Hábito',
        updateHabit: 'Actualizar Hábito',
        deleteHabit: 'Eliminar Hábito',
        deleteConfirm: '¿Estás seguro de que quieres eliminar este hábito? Esta acción no se puede deshacer.',
        suggestions: 'Sugerencias',
    },

    // Stats Screen
    stats: {
        title: 'Estadísticas',
        overview: 'Resumen',
        totalXp: 'XP Total',
        currentLevel: 'Nivel Actual',
        totalHabits: 'Total de Hábitos',
        bestStreak: 'Mejor Racha',
        completionRate: 'Tasa de Completado',
        last30Days: 'Últimos 30 Días',
        last365Days: 'Últimos 365 Días',
        weeklyStats: 'Estadísticas Semanales',
        monthlyStats: 'Estadísticas Mensuales',
        noDataYet: 'Sin datos aún',
        keepTracking: '¡Sigue registrando tus hábitos para ver estadísticas!',
        allTime: 'Todo el Tiempo',
        completions: 'Completados',
        perfectDays: 'Días Perfectos',
        activeDays: 'Días Activos',
        dailyAvg: 'Promedio Diario',
        dailyBreakdown: 'Desglose Diario',
        topHabits: 'Mejores Hábitos por Racha',
        resetData: 'Restablecer Todos los Datos',
        resetWarning: 'Esto eliminará todos los hábitos y el progreso. No se puede deshacer.',
        preview: 'Vista Previa',
        everyDay: 'Todos los días',
        yourNewHabit: 'Tu nuevo hábito',
        target: 'Meta',
    },

    // Settings / Widget Hub
    settings: {
        title: 'Ajustes',
        todaysProgress: 'PROGRESO DE HOY',
        quickStats: 'ESTADÍSTICAS RÁPIDAS',
        quickActions: 'ACCIONES RÁPIDAS',
        habitsDone: '{{completed}}/{{total}} hábitos completados',
        perfectDay: '🎉 ¡Día Perfecto!',
        level: 'Nivel {{level}}',
        bestStreak: 'Mejor Racha',
        habits: 'Hábitos',
        totalDays: 'Días Totales',
        levelInfo: 'Info de Nivel',
        levelInfoMessage: '¡Eres Nivel {{level}}! Gana XP completando hábitos. {{remaining}} XP hasta el siguiente nivel.',
        bestStreakInfo: 'Mejor Racha',
        bestStreakMessage: 'Tu racha más larga actual es de {{streak}} días. ¡Mantén el impulso!',
        totalHabitsInfo: 'Total de Hábitos',
        totalHabitsMessage: 'Estás siguiendo {{count}} hábitos. ¡Buena disciplina!',
        combinedStreaks: 'Rachas Combinadas',
        combinedStreaksMessage: 'Tus días de racha combinados de todos los hábitos: ¡{{days}} días!',
        noHabitsQuickActions: 'Sin hábitos aún. ¡Añade algunos hábitos para ver acciones rápidas aquí!',
        keepGoing: '¡Sigue Adelante! 💪',
        keepGoingMessage: 'Cada día es una nueva oportunidad para construir la vida que deseas. Pequeñas acciones llevan a grandes cambios.',
        language: 'Idioma',
        theme: 'Tema',
        notifications: 'Notificaciones',
        resetApp: 'Reiniciar App',
        resetAppConfirm: '¿Estás seguro de que quieres reiniciar todos los datos? Esto no se puede deshacer.',
        about: 'Acerca de',
        version: 'Versión',
        privacyPolicy: 'Política de Privacidad',
        termsOfService: 'Términos de Servicio',
    },

    // Share Screen
    share: {
        title: 'Compartir Progreso',
        shareYourProgress: 'Comparte Tu Progreso',
        downloadImage: 'Descargar Imagen',
        shareToSocial: 'Compartir en Redes',
        copyLink: 'Copiar Enlace',
        copied: '¡Copiado!',
        currentLevel: 'Nivel Actual',
        bestStreak: 'Mejor Racha',
        doneToday: 'Hecho Hoy',
        dayStreak: 'días de racha',
        trackedWith: 'Seguido con HabitFlow',
    },

    // Level & XP
    level: {
        levelUp: '¡Subiste de Nivel!',
        xpGained: '+{{xp}} XP',
        xpToNextLevel: '{{xp}} XP para Nivel {{level}}',
    },

    // Streaks
    streak: {
        dayStreak: 'Racha de {{count}} días',
        streakLost: 'Racha Perdida',
        keepItUp: '¡Sigue así!',
    },

    // Calendar
    calendar: {
        sunday: 'Dom',
        monday: 'Lun',
        tuesday: 'Mar',
        wednesday: 'Mié',
        thursday: 'Jue',
        friday: 'Vie',
        saturday: 'Sáb',
        januaryShort: 'Ene',
        februaryShort: 'Feb',
        marchShort: 'Mar',
        aprilShort: 'Abr',
        mayShort: 'May',
        juneShort: 'Jun',
        julyShort: 'Jul',
        augustShort: 'Ago',
        septemberShort: 'Sep',
        octoberShort: 'Oct',
        novemberShort: 'Nov',
        decemberShort: 'Dic',
    },

    // Motivational Quotes
    quotes: {
        quote1: { text: "El éxito es la suma de pequeños esfuerzos, repetidos día tras día.", author: "Robert Collier" },
        quote2: { text: "Somos lo que hacemos repetidamente. La excelencia, entonces, no es un acto, sino un hábito.", author: "Aristóteles" },
        quote3: { text: "El secreto de tu futuro está escondido en tu rutina diaria.", author: "Mike Murdock" },
        quote4: { text: "La motivación es lo que te hace empezar. El hábito es lo que te mantiene.", author: "Jim Ryun" },
        quote5: { text: "Pequeñas mejoras diarias con el tiempo llevan a resultados asombrosos.", author: "Robin Sharma" },
        quote6: { text: "Tus hábitos determinarán tu futuro.", author: "Jack Canfield" },
        quote7: { text: "Los campeones no hacen cosas extraordinarias. Hacen cosas ordinarias, pero las hacen sin pensar.", author: "Charles Duhigg" },
        quote8: { text: "La única manera de hacer un gran trabajo es amar lo que haces.", author: "Steve Jobs" },
        quote9: { text: "No es lo que hacemos de vez en cuando lo que da forma a nuestras vidas, sino lo que hacemos consistentemente.", author: "Tony Robbins" },
        quote10: { text: "Primero olvida la inspiración. El hábito es más confiable.", author: "Octavia Butler" },
    },

    // Confirmation dialogs
    confirm: {
        deleteTitle: 'Eliminar Hábito',
        deleteMessage: '¿Estás seguro de que quieres eliminar "{{name}}"? Esta acción no se puede deshacer.',
        resetTitle: 'Reiniciar Todos los Datos',
        resetMessage: 'Esto eliminará todos tus hábitos y progreso. ¿Estás seguro?',
    },
};
