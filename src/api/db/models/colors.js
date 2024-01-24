import randomColor from 'random-hex-color';

export default function(existingLabels) {
    const defaultColors = [
        '#8D8D8D', '#E54D2E', '#E5484D', '#E54666',
        '#E93D82', '#D6409F', '#AB4ABA', '#8E4EC6',
        '#6E56CF', '#5B5BD6', '#3E63DD', '#0090FF',
        '#00A2C7', '#12A594', '#29A383', '#30A46C',
        '#46A758', '#A18072', '#978365', '#AD7F58',
        '#F76B15', '#FFC53D', '#FFE629', '#BDEE63',
        '#86EAD4', '#7CE2FE'
    ];

    for (const label of existingLabels) {
        const i = defaultColors.indexOf(label.color)
        if (i === -1) continue;
        defaultColors.splice(i, 1)
    }

    if (defaultColors.length === 0) {
        return randomColor()
    } else {
        return defaultColors[Math.floor(Math.random() * (defaultColors.length))]
    }
}
