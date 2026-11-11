import { Translation } from 'primeng/api';
import { Lang } from './i18n';

/** PrimeNG built-in texts (datepicker, confirm dialog, filters…) per language. English is PrimeNG's default. */
export const PRIMENG_TRANSLATIONS: Partial<Record<Lang, Translation>> = {
  fr: {
    accept: 'Oui', reject: 'Non', cancel: 'Annuler', clear: 'Effacer', apply: 'Appliquer', choose: 'Choisir',
    dayNames: ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'],
    dayNamesShort: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
    dayNamesMin: ['D', 'L', 'M', 'M', 'J', 'V', 'S'],
    monthNames: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'],
    monthNamesShort: ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'],
    today: "Aujourd'hui", weekHeader: 'Sem', firstDayOfWeek: 1, dateFormat: 'dd/mm/yy',
    emptyMessage: 'Aucun résultat', emptyFilterMessage: 'Aucun résultat', emptySelectionMessage: 'Aucun élément sélectionné',
    selectionMessage: '{0} éléments sélectionnés', searchMessage: '{0} résultats disponibles',
  },
  es: {
    accept: 'Sí', reject: 'No', cancel: 'Cancelar', clear: 'Limpiar', apply: 'Aplicar', choose: 'Elegir',
    dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
    dayNamesShort: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
    dayNamesMin: ['D', 'L', 'M', 'X', 'J', 'V', 'S'],
    monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
    monthNamesShort: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
    today: 'Hoy', weekHeader: 'Sem', firstDayOfWeek: 1, dateFormat: 'dd/mm/yy',
    emptyMessage: 'Sin resultados', emptyFilterMessage: 'Sin resultados', emptySelectionMessage: 'Ningún elemento seleccionado',
    selectionMessage: '{0} elementos seleccionados', searchMessage: '{0} resultados disponibles',
  },
  ar: {
    accept: 'نعم', reject: 'لا', cancel: 'إلغاء', clear: 'مسح', apply: 'تطبيق', choose: 'اختيار',
    dayNames: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
    dayNamesShort: ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'],
    dayNamesMin: ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'],
    monthNames: ['يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو', 'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر'],
    monthNamesShort: ['يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو', 'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر'],
    today: 'اليوم', weekHeader: 'أسبوع', firstDayOfWeek: 1, dateFormat: 'dd/mm/yy',
    emptyMessage: 'لا توجد نتائج', emptyFilterMessage: 'لا توجد نتائج', emptySelectionMessage: 'لم يتم تحديد أي عنصر',
    selectionMessage: 'تم تحديد {0} عناصر', searchMessage: '{0} نتائج متاحة',
  },
};
