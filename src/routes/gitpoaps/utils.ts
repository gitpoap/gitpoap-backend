import { DateTime } from 'luxon';
import { GITPOAP_ROOT_URL } from '../../constants';

export const generateGitPOAPRequestLink = (customGitPOAPId: number): string => {
  return `${GITPOAP_ROOT_URL}/create/${customGitPOAPId}`;
};

export const generateGitPOAPLink = (gitPOAPId: number): string => {
  return `${GITPOAP_ROOT_URL}/gp/${gitPOAPId}`;
};

export const formatDateToString = (date: Date): string =>
  DateTime.fromJSDate(date).toFormat('yyyy LLL dd');
